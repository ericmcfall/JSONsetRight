// Loads a JSON Schema (and any schemas it refers to), compiles it with Ajv, and validates
// documents against it, turning Ajv's errors into plain-language problems at tree paths.
import Ajv, { type AnySchemaObject, type ErrorObject, type ValidateFunction } from "ajv";
import Ajv2019 from "ajv/dist/2019";
import Ajv2020 from "ajv/dist/2020";
import AjvDraft04 from "ajv-draft-04";
import addFormats from "ajv-formats";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import type { JsonDocument } from "../document";
import { findNode, valueOf, type Path } from "../nodes";
import { fileUrlToPath, pathToFileUrl } from "./locate";

/** Reads a schema's text from a file path or http(s) URL. */
export type SchemaLoader = (location: string) => Promise<string>;

export type SchemaObject = Record<string, unknown>;

export interface SchemaProblem {
  path: Path;
  message: string;
}

export interface CompiledSchema {
  location: string;
  /** URI used as the root schema's base for resolving relative $refs. */
  baseUri: string;
  root: SchemaObject;
  /** Every schema document loaded for this schema, by URI (without #fragment). */
  documents: Map<string, SchemaObject>;
  validate(doc: JsonDocument): SchemaProblem[];
}

export class SchemaLoadError extends Error {}

/** URIs of the JSON Schema meta-schemas Ajv already knows, so they work offline. */
const META_SCHEMAS = /^https?:\/\/json-schema\.org\/(draft-0[467]|draft\/2019-09|draft\/2020-12)\/schema#?$/;

export async function compileSchema(location: string, load: SchemaLoader): Promise<CompiledSchema> {
  const baseUri = /^https?:/i.test(location) ? location.split("#")[0] : pathToFileUrl(location);
  const documents = new Map<string, SchemaObject>();

  const readSchema = async (uri: string): Promise<SchemaObject> => {
    const key = uri.split("#")[0];
    const known = documents.get(key);
    if (known) return known;
    let text: string;
    try {
      text = await load(/^file:/i.test(key) ? fileUrlToPath(key) : key);
    } catch (error) {
      throw new SchemaLoadError(String(error));
    }
    const errors: ParseError[] = [];
    const schema = parseJsonc(text, errors, { allowTrailingComma: true }) as unknown;
    if (errors.length > 0 || typeof schema !== "object" || schema === null) {
      throw new SchemaLoadError(`${key} is not a valid JSON Schema file.`);
    }
    const object = schema as SchemaObject;
    // Give the schema its address as $id so references relative to it resolve.
    const declaredId = typeof object.$id === "string" ? object.$id : typeof object.id === "string" ? object.id : null;
    if (!declaredId) object.$id = key;
    documents.set(key, object);
    if (declaredId) {
      try {
        documents.set(new URL(declaredId, key).href.split("#")[0], object);
      } catch {
        // an unusual $id; references by file address still work
      }
    }
    return object;
  };

  if (META_SCHEMAS.test(location)) {
    const ajv = createAjv(location);
    const validate = ajv.getSchema(location.replace(/#?$/, "#")) ?? ajv.getSchema(location.replace(/#$/, ""));
    if (!validate) throw new SchemaLoadError(`Unknown meta-schema ${location}`);
    const root = validate.schema as SchemaObject;
    documents.set(baseUri, root);
    return { location, baseUri, root, documents, validate: (doc) => runValidation(validate, doc) };
  }

  const root = await readSchema(baseUri);
  const ajv = createAjv(String(root.$schema ?? ""), (uri) => readSchema(uri) as Promise<AnySchemaObject>);
  let validate: ValidateFunction;
  try {
    validate = await ajv.compileAsync(root);
  } catch (error) {
    if (error instanceof SchemaLoadError) throw error;
    throw new SchemaLoadError(`The schema could not be used: ${(error as Error).message}`);
  }
  return { location, baseUri, root, documents, validate: (doc) => runValidation(validate, doc) };
}

function createAjv(metaSchema: string, loadSchema?: (uri: string) => Promise<AnySchemaObject>) {
  const options = { allErrors: true, strict: false, verbose: true, validateSchema: false, loadSchema };
  const ajv = metaSchema.includes("2020-12")
    ? new Ajv2020(options)
    : metaSchema.includes("2019-09")
      ? new Ajv2019(options)
      : metaSchema.includes("draft-04")
        ? new AjvDraft04(options)
        : new Ajv(options);
  addFormats(ajv as Ajv);
  return ajv as Ajv;
}

function runValidation(validate: ValidateFunction, doc: JsonDocument): SchemaProblem[] {
  validate(valueOf(doc.root));
  return describeErrors(doc, validate.errors ?? []);
}

/** Turns Ajv errors into short messages, dropping noise from anyOf/oneOf/if branches. */
export function describeErrors(doc: JsonDocument, errors: ErrorObject[]): SchemaProblem[] {
  const specific = errors.filter((e) => !["anyOf", "oneOf", "if", "not", "allOf"].includes(e.keyword));
  // "Must be one of: ..." already says what type is expected, so skip the type error beside it.
  const listed = new Set(specific.filter((e) => e.keyword === "enum" || e.keyword === "const").map((e) => e.instancePath));
  const chosen = (specific.length > 0 ? specific : errors).filter((e) => !(e.keyword === "type" && listed.has(e.instancePath)));
  const seen = new Set<string>();
  const problems: SchemaProblem[] = [];
  for (const error of chosen) {
    let path = pointerToPath(doc, error.instancePath);
    const params = error.params as Record<string, unknown>;
    if (error.keyword === "additionalProperties" || error.keyword === "unevaluatedProperties") {
      const key = String(params.additionalProperty ?? params.unevaluatedProperty);
      path = [...path, key];
    }
    const message = describe(error);
    const id = JSON.stringify(path) + message;
    if (seen.has(id)) continue;
    seen.add(id);
    problems.push({ path, message });
  }
  return problems;
}

const TYPE_WORDS: Record<string, string> = {
  string: "text",
  number: "a number",
  integer: "a whole number",
  boolean: "true or false",
  object: "an object",
  array: "a list",
  null: "null",
};

function describe(error: ErrorObject): string {
  const p = error.params as Record<string, unknown>;
  const parent = (error.parentSchema ?? {}) as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return `Missing required property "${p.missingProperty}"`;
    case "additionalProperties":
    case "unevaluatedProperties":
      return `"${p.additionalProperty ?? p.unevaluatedProperty}" is not a known property here`;
    case "type": {
      const types = Array.isArray(p.type) ? p.type : String(p.type).split(",");
      return `Should be ${types.map((t: string) => TYPE_WORDS[t] ?? t).join(" or ")}`;
    }
    case "enum": {
      const allowed = (p.allowedValues as unknown[]) ?? [];
      const list = allowed.slice(0, 10).map((v) => JSON.stringify(v)).join(", ");
      return `Must be one of: ${list}${allowed.length > 10 ? ", …" : ""}`;
    }
    case "const":
      return `Must be ${JSON.stringify(p.allowedValue)}`;
    case "pattern":
      return typeof parent.patternErrorMessage === "string"
        ? parent.patternErrorMessage
        : `Doesn't match the expected pattern ${p.pattern}`;
    case "format":
      return `Should be a valid ${p.format}`;
    case "minimum": case "maximum": case "exclusiveMinimum": case "exclusiveMaximum":
      return `Must be ${p.comparison} ${p.limit}`;
    default: {
      if (typeof parent.errorMessage === "string") return parent.errorMessage;
      const text = error.message ?? error.keyword;
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
}

/** "/servers/0/port" -> ["servers", 0, "port"], using the document to tell array indexes apart. */
export function pointerToPath(doc: JsonDocument, pointer: string): Path {
  const path: Path = [];
  if (!pointer) return path;
  for (const raw of pointer.split("/").slice(1)) {
    const segment = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    const node = findNode(doc, path);
    path.push(node?.type === "array" && /^\d+$/.test(segment) ? Number(segment) : segment);
  }
  return path;
}
