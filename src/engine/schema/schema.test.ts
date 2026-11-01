import { describe, expect, it } from "vitest";
import { parseDocument } from "../document";
import { compileSchema, findSchemaSource, globMatches, hintsAt, joinPath, pathToFileUrl, resolveLocation, type SchemaLoader } from "./index";

// A small "file system" of schemas: the main one refers to a definition and to a second file.
const files: Record<string, unknown> = {
  "C:\\schemas\\app.schema.json": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "App settings",
    type: "object",
    required: ["name", "logging"],
    additionalProperties: false,
    properties: {
      $schema: { type: "string" },
      name: { type: "string", description: "Display name", minLength: 1 },
      port: { type: "integer", minimum: 1, maximum: 65535, default: 8080 },
      mode: { enum: ["dev", "prod"], enumDescriptions: ["Development", "Production"], default: "dev" },
      logging: { $ref: "#/definitions/logging" },
      servers: { type: "array", items: { $ref: "server.schema.json" } },
      oldSetting: { type: "boolean", deprecationMessage: "Use mode instead." },
    },
    definitions: {
      logging: {
        type: "object",
        properties: { level: { type: "string", enum: ["debug", "info", "warn"] } },
        additionalProperties: { type: "string" },
      },
    },
  },
  "C:\\schemas\\server.schema.json": {
    type: "object",
    required: ["host"],
    properties: { host: { type: "string", format: "hostname", description: "Server host name" } },
  },
};
const loads: string[] = [];
const loader: SchemaLoader = async (location) => {
  loads.push(location);
  if (!(location in files)) throw new Error(`not found: ${location}`);
  return JSON.stringify(files[location]);
};
const compile = () => compileSchema("C:\\schemas\\app.schema.json", loader);

describe("finding the schema", () => {
  const doc = parseDocument('{"$schema": "../schemas/app.schema.json", "name": "x"}');
  const rules = [{ pattern: "appsettings*.json", schema: "C:\\rule.json" }];

  it("uses $schema, relative to the file", () => {
    expect(findSchemaSource(doc, "C:\\work\\cfg.json", {}, rules)).toEqual({ kind: "$schema", location: "C:\\schemas\\app.schema.json" });
  });

  it("a manual choice wins, and an empty choice means none", () => {
    const pairs = { "c:\\work\\cfg.json": "C:\\mine.json" };
    expect(findSchemaSource(doc, "C:\\work\\cfg.json", pairs, rules)?.location).toBe("C:\\mine.json");
    expect(findSchemaSource(doc, "C:\\work\\cfg.json", { "c:\\work\\cfg.json": "" }, rules)).toBeNull();
  });

  it("falls back to filename rules", () => {
    const plain = parseDocument("{}");
    expect(findSchemaSource(plain, "C:\\x\\AppSettings.Development.json", {}, rules)).toEqual({ kind: "rule", location: "C:\\rule.json" });
    expect(findSchemaSource(plain, "C:\\x\\other.json", {}, rules)).toBeNull();
  });

  it("handles paths, URLs and globs", () => {
    expect(resolveLocation("https://json.schemastore.org/package.json", null)).toBe("https://json.schemastore.org/package.json");
    expect(resolveLocation("./a.json", null)).toBeNull();
    expect(resolveLocation("file:///C:/My%20Schemas/a.json", null)).toBe("C:\\My Schemas\\a.json");
    expect(joinPath("C:\\a\\b", "..\\c/./d.json")).toBe("C:\\a\\c\\d.json");
    expect(pathToFileUrl("C:\\My Schemas\\a.json")).toBe("file:///C:/My%20Schemas/a.json");
    expect(globMatches("*.config.json", "C:\\x\\app.config.json")).toBe(true);
    expect(globMatches("app?.json", "C:\\x\\app.json")).toBe(false);
  });
});

describe("validation", () => {
  it("reports problems in plain language at the right paths", async () => {
    const schema = await compile();
    const doc = parseDocument('{"name": "", "port": 70000, "mode": "test", "extra": 1, "logging": {"level": 3}, "servers": [{"port": 1}]}');
    const problems = schema.validate(doc);
    const byPath = Object.fromEntries(problems.map((p) => [JSON.stringify(p.path), p.message]));
    expect(byPath['["name"]']).toMatch(/fewer than 1 character/);
    expect(byPath['["port"]']).toBe("Must be <= 65535");
    expect(byPath['["mode"]']).toBe('Must be one of: "dev", "prod"');
    expect(byPath['["extra"]']).toBe('"extra" is not a known property here');
    expect(byPath['["logging","level"]']).toBe('Must be one of: "debug", "info", "warn"');
    expect(problems.filter((p) => p.path.join() === "logging,level")).toHaveLength(1);
    expect(byPath['["servers",0]']).toBe('Missing required property "host"');
  });

  it("passes a valid document", async () => {
    const schema = await compile();
    const doc = parseDocument('// ok\n{"name": "a", "logging": {}, "servers": [{"host": "example.com"}],}');
    expect(schema.validate(doc)).toEqual([]);
  });

  it("loads referenced files once", async () => {
    loads.length = 0;
    await compile();
    expect(loads).toEqual(["C:\\schemas\\app.schema.json", "C:\\schemas\\server.schema.json"]);
  });

  it("explains a missing schema file", async () => {
    await expect(compileSchema("C:\\nope.json", loader)).rejects.toThrow(/not found/);
  });

  it("knows the standard meta-schemas without downloading", async () => {
    const meta = await compileSchema("http://json-schema.org/draft-07/schema#", async () => {
      throw new Error("should not download");
    });
    expect(meta.validate(parseDocument('{"type": 5}')).length).toBeGreaterThan(0);
    expect(meta.validate(parseDocument('{"type": "string"}'))).toEqual([]);
  });
});

describe("hints", () => {
  it("describes the root object's properties", async () => {
    const hint = hintsAt(await compile(), [])!;
    expect(hint.title).toBe("App settings");
    expect(hint.required).toEqual(["name", "logging"]);
    expect(hint.allowsOtherProperties).toBe(false);
    const port = hint.properties.find((p) => p.name === "port")!;
    expect(port).toMatchObject({ kinds: ["number"], defaultValue: 8080, required: false });
    expect(hint.properties.find((p) => p.name === "oldSetting")!.deprecated).toBe(true);
  });

  it("gives enum choices with descriptions", async () => {
    const hint = hintsAt(await compile(), ["mode"])!;
    expect(hint.enumValues).toEqual(["dev", "prod"]);
    expect(hint.enumDescriptions).toEqual(["Development", "Production"]);
    expect(hint.kinds).toEqual(["string"]);
  });

  it("follows $ref within and across files", async () => {
    const schema = await compile();
    expect(hintsAt(schema, ["logging", "level"])!.enumValues).toEqual(["debug", "info", "warn"]);
    expect(hintsAt(schema, ["logging", "anything"])!.kinds).toEqual(["string"]); // additionalProperties
    expect(hintsAt(schema, ["servers", 3, "host"])!.description).toBe("Server host name");
    expect(hintsAt(schema, ["servers"])!.itemKinds).toEqual(["object"]);
  });

  it("knows integers and deprecation", async () => {
    const schema = await compile();
    expect(hintsAt(schema, ["port"])!.integer).toBe(true);
    expect(hintsAt(schema, ["oldSetting"])!.deprecated).toBe("Use mode instead.");
  });

  it("returns null where the schema says nothing", async () => {
    expect(hintsAt(await compile(), ["unknown", "deeper"])).toBeNull();
  });
});
