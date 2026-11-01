import { describe, expect, it } from "vitest";
import { commentsFor, parseDocument } from "../engine";
import { buildRows, pathKey } from "./tree-model";

const doc = parseDocument(
  [
    "// File header",
    "{",
    '  "server": {',
    "    // The port to listen on",
    '    "port": 8080, // must be > 1024',
    '    "host": "localhost"',
    "  },",
    '  /* tags */ "tags": ["alpha", "beta"]',
    "}",
  ].join("\n"),
);

describe("buildRows", () => {
  it("shows only expanded containers", () => {
    const rows = buildRows(doc, new Set([pathKey([])]), "");
    expect(rows.map((r) => r.key)).toEqual([null, "server", "tags"]);
    expect(rows[1]).toMatchObject({ kind: "object", preview: "{2}", expanded: false, depth: 1, index: 0 });
  });

  it("expands nested containers", () => {
    const rows = buildRows(doc, new Set([pathKey([]), pathKey(["server"])]), "");
    expect(rows.map((r) => r.key)).toEqual([null, "server", "port", "host", "tags"]);
    expect(rows[2]).toMatchObject({ preview: "8080", path: ["server", "port"] });
  });

  it("search shows matches and their ancestors only", () => {
    const rows = buildRows(doc, new Set(), "beta");
    expect(rows.map((r) => r.key)).toEqual([null, "tags", 1]);
    expect(rows.map((r) => r.match)).toEqual([false, false, true]);
  });

  it("search matches keys", () => {
    const rows = buildRows(doc, new Set(), "HOST");
    expect(rows.map((r) => r.key)).toEqual([null, "server", "host"]);
  });
});

describe("commentsFor", () => {
  it("finds comments above and after a value", () => {
    expect(commentsFor(doc, ["server", "port"])).toEqual(["The port to listen on", "must be > 1024"]);
  });

  it("does not give a value its neighbor's comment", () => {
    expect(commentsFor(doc, ["server", "host"])).toEqual([]);
  });

  it("finds inline block comments and the file header", () => {
    expect(commentsFor(doc, ["tags"])).toEqual(["tags"]);
    expect(commentsFor(doc, [])).toEqual(["File header"]);
  });
});
