// Answers "what does the schema say about the value at this path?" for the editing UI:
// description, allowed types and values, default, and (for objects) known properties.
import type { JsonValue, Path, ValueKind } from "../nodes";
import type { CompiledSchema, SchemaObject } from "./compile";

export interface PropertyHint {
  name: string;
  description?: string;
  required: boolean;
  kinds: ValueKind[];
  defaultValue?: JsonValue;
  hasDefault: boolean;
  deprecated: boolean;
}

export interface SchemaHint {
  title?: string;
  description?: string;
  /** Allowed kinds; empty means the schema allows anything. */
  kinds: ValueKind[];
  /** True if the schema requires a whole number. */
  integer: boolean;
  enumValues?: JsonValue[];
  enumDescriptions?: string[];
  defaultValue?: JsonValue;
  hasDefault: boolean;
  deprecated?: string;
  /** For objects: properties the schema knows about. */
  properties: PropertyHint[];
  required: string[];
  /** For objects: whether keys not listed in `properties` are allowed. */
  allowsOtherProperties: boolean;
  /** For arrays: a hint for new items. */
  itemKinds: ValueKind[];
}

/** A subschema plus the URI its $refs are relative to. */
interface Located {
  schema: SchemaObject | boolean;
  base: string;
}

const MAX_DEPTH = 40;

/** Hints for the value at `path`, or null if the schema says nothing about it. */
export function hintsAt(compiled: CompiledSchema, path: Path): SchemaHint | null {
  let current = expand(compiled, [{ schema: compiled.root, base: compiled.baseUri }]);
  for (const segment of path) {
    current = expand(compiled, current.flatMap((c) => childSchemas(c, segment)));
    if (current.length === 0) return null;
  }
  return summarize(compiled, current);
}

/** Follows $ref, allOf, anyOf and oneOf so the list holds concrete schemas. */
function expand(compiled: CompiledSchema, items: Located[], depth = 0): Located[] {
  const out: Located[] = [];
  for (const item of items) {
    if (typeof item.schema !== "object" || item.schema === null) {
      if (item.schema === true) out.push(item);
      continue;
    }
    const s = item.schema;
    const base = typeof s.$id === "string" ? resolveUri(s.$id, item.base) : item.base;
    out.push({ schema: s, base });
    if (depth >= MAX_DEPTH) continue;
    const nested: Located[] = [];
    if (typeof s.$ref === "string") {
      const target = resolveRef(compiled, s.$ref, base);
      if (target) nested.push(target);
    }
    for (const key of ["allOf", "anyOf", "oneOf"]) {
      const list = s[key];
      if (Array.isArray(list)) nested.push(...list.map((schema) => ({ schema, base })));
    }
    out.push(...expand(compiled, nested, depth + 1));
  }
  return out;
}

function childSchemas(item: Located, segment: string | number): Located[] {
  if (typeof item.schema !== "object") return item.schema ? [{ schema: true, base: item.base }] : [];
  const s = item.schema;
  const wrap = (schema: unknown): Located[] =>
    schema === undefined ? [] : [{ schema: schema as SchemaObject | boolean, base: item.base }];

  if (typeof segment === "string") {
    const props = s.properties as Record<string, unknown> | undefined;
    if (props && segment in props) return wrap(props[segment]);
    const patterns = s.patternProperties as Record<string, unknown> | undefined;
    const matched = Object.entries(patterns ?? {}).filter(([pattern]) => safeRegex(pattern)?.test(segment));
    if (matched.length > 0) return matched.flatMap(([, schema]) => wrap(schema));
    return typeof s.additionalProperties === "object" ? wrap(s.additionalProperties) : [];
  }
  if (Array.isArray(s.prefixItems)) {
    return segment < s.prefixItems.length ? wrap(s.prefixItems[segment]) : wrap(s.items);
  }
  if (Array.isArray(s.items)) {
    return segment < s.items.length ? wrap(s.items[segment]) : wrap(s.additionalItems);
  }
  return wrap(s.items);
}

function summarize(compiled: CompiledSchema, items: Located[]): SchemaHint {
  const objects = items.map((i) => i.schema).filter((s): s is SchemaObject => typeof s === "object");
  const first = <T>(key: string, test: (v: unknown) => v is T): T | undefined => {
    for (const s of objects) if (test(s[key])) return s[key] as T;
    return undefined;
  };
  const isString = (v: unknown): v is string => typeof v === "string";

  const kinds = kindsOf(objects);
  const enumSources = objects.filter((s) => Array.isArray(s.enum) || "const" in s);
  const enumValues = enumSources.length > 0
    ? dedupe(enumSources.flatMap((s) => (Array.isArray(s.enum) ? s.enum : [s.const])) as JsonValue[])
    : undefined;
  const defaultSource = objects.find((s) => "default" in s);

  // Known properties from every candidate schema (first description wins).
  const required = dedupe(objects.flatMap((s) => (Array.isArray(s.required) ? s.required.filter(isString) : [])));
  const props = new Map<string, PropertyHint>();
  for (const item of items) {
    if (typeof item.schema !== "object") continue;
    for (const [name, raw] of Object.entries((item.schema.properties as Record<string, unknown>) ?? {})) {
      if (props.has(name)) continue;
      const sub = expand(compiled, [{ schema: raw as SchemaObject, base: item.base }]);
      const subObjects = sub.map((x) => x.schema).filter((x): x is SchemaObject => typeof x === "object");
      const withDefault = subObjects.find((x) => "default" in x);
      props.set(name, {
        name,
        description: descriptionOf(subObjects),
        required: required.includes(name),
        kinds: kindsOf(subObjects),
        defaultValue: withDefault?.default as JsonValue | undefined,
        hasDefault: !!withDefault,
        deprecated: subObjects.some((x) => x.deprecated === true || typeof x.deprecationMessage === "string"),
      });
    }
  }
  const allowsOtherProperties = !objects.some((s) => s.additionalProperties === false && !s.patternProperties);

  const itemSchemas = expand(compiled, items.flatMap((i) => childSchemas(i, Number.MAX_SAFE_INTEGER)));
  const itemKinds = kindsOf(itemSchemas.map((x) => x.schema).filter((x): x is SchemaObject => typeof x === "object"));

  const deprecation = objects.find((s) => s.deprecated === true || typeof s.deprecationMessage === "string");
  return {
    title: first("title", isString),
    description: descriptionOf(objects),
    kinds,
    integer: objects.some((s) => s.type === "integer") && !objects.some((s) => s.type === "number"),
    enumValues,
    enumDescriptions: first("enumDescriptions", (v): v is string[] => Array.isArray(v)) ?? first("markdownEnumDescriptions", (v): v is string[] => Array.isArray(v)),
    defaultValue: defaultSource?.default as JsonValue | undefined,
    hasDefault: !!defaultSource,
    deprecated: deprecation ? (typeof deprecation.deprecationMessage === "string" ? deprecation.deprecationMessage : "This setting is deprecated.") : undefined,
    properties: [...props.values()],
    required,
    allowsOtherProperties,
    itemKinds,
  };
}

function descriptionOf(objects: SchemaObject[]): string | undefined {
  for (const s of objects) {
    if (typeof s.description === "string") return s.description;
    if (typeof s.markdownDescription === "string") return stripMarkdown(s.markdownDescription);
  }
  return undefined;
}

/** JSON Schema "type" keywords to the editor's value kinds. Empty = any. */
function kindsOf(objects: SchemaObject[]): ValueKind[] {
  const kinds = new Set<ValueKind>();
  let constrained = false;
  for (const s of objects) {
    const types = Array.isArray(s.type) ? s.type : typeof s.type === "string" ? [s.type] : [];
    if (types.length > 0) constrained = true;
    for (const t of types) kinds.add(t === "integer" ? "number" : (t as ValueKind));
    for (const v of Array.isArray(s.enum) ? s.enum : "const" in s ? [s.const] : []) {
      constrained = true;
      kinds.add(kindOfValue(v as JsonValue));
    }
  }
  return constrained ? [...kinds] : [];
}

export function kindOfValue(v: JsonValue): ValueKind {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as ValueKind;
}

function resolveRef(compiled: CompiledSchema, ref: string, base: string): Located | undefined {
  const uri = resolveUri(ref, base);
  const [docUri, fragment = ""] = uri.split("#");
  const document = compiled.documents.get(docUri) ?? (docUri === "" ? compiled.root : undefined);
  if (!document) return undefined;
  let target: unknown = document;
  for (const raw of fragment.split("/").slice(1)) {
    if (typeof target !== "object" || target === null) return undefined;
    target = (target as Record<string, unknown>)[decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return target === undefined ? undefined : { schema: target as SchemaObject, base: docUri };
}

function resolveUri(ref: string, base: string): string {
  try {
    return new URL(ref, base).href;
  } catch {
    return ref;
  }
}

function safeRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "u");
  } catch {
    return undefined;
  }
}

function dedupe<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = JSON.stringify(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_]/g, "");
}
