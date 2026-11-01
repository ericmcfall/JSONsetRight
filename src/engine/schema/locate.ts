// Decides which JSON Schema applies to a file. Order:
//   1. a schema the user picked for this file (or "none" to switch schemas off)
//   2. the file's own "$schema" property (a web address or a path relative to the file)
//   3. a filename rule from Settings, e.g. appsettings*.json -> C:\schemas\appsettings.schema.json
import type { JsonDocument } from "../document";
import { childrenOf } from "../nodes";

export type SchemaSourceKind = "manual" | "$schema" | "rule";

export interface SchemaSource {
  kind: SchemaSourceKind;
  /** An absolute Windows file path or an http(s) URL. */
  location: string;
}

export interface SchemaRule {
  /** File-name pattern with * and ?, e.g. "appsettings*.json". Matched without regard to case. */
  pattern: string;
  /** Schema file path or URL. */
  schema: string;
}

/** Manual choices, keyed by lower-case file path. An empty string means "use no schema". */
export type SchemaPairs = Record<string, string>;

export function findSchemaSource(
  doc: JsonDocument,
  filePath: string | null,
  pairs: SchemaPairs,
  rules: SchemaRule[],
): SchemaSource | null {
  const manual = filePath ? pairs[filePath.toLowerCase()] : undefined;
  if (manual !== undefined) return manual === "" ? null : { kind: "manual", location: manual };

  const declared = declaredSchema(doc);
  if (declared) {
    const location = resolveLocation(declared, filePath);
    if (location) return { kind: "$schema", location };
  }

  if (filePath) {
    const rule = rules.find((r) => r.pattern.trim() && globMatches(r.pattern.trim(), filePath));
    if (rule) return { kind: "rule", location: rule.schema };
  }
  return null;
}

/** The value of a top-level "$schema" property, if the document has one. */
export function declaredSchema(doc: JsonDocument): string | null {
  const entry = childrenOf(doc.root).find((c) => c.key === "$schema");
  return entry && entry.node.type === "string" ? (entry.node.value as string) : null;
}

/** Turns a $schema value into a URL or absolute path. Relative paths are relative to the file. */
export function resolveLocation(value: string, filePath: string | null): string | null {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^file:\/\//i.test(v)) return fileUrlToPath(v);
  if (isAbsolutePath(v)) return v.replace(/\//g, "\\");
  if (!filePath) return null; // a relative path needs the file's folder
  return joinPath(dirName(filePath), v);
}

export function isAbsolutePath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}

export function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i === -1 ? "" : path.slice(0, i);
}

/** Joins a folder and a relative path, resolving "." and "..". */
export function joinPath(folder: string, relative: string): string {
  const parts = folder.split(/[\\/]/);
  for (const segment of relative.split(/[\\/]/)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length > 1) parts.pop();
    } else parts.push(segment);
  }
  return parts.join("\\");
}

export function pathToFileUrl(path: string): string {
  return "file:///" + path.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/").replace(/^([A-Za-z])%3A/, "$1:");
}

export function fileUrlToPath(url: string): string {
  return decodeURIComponent(url.replace(/^file:\/\/\/?/i, "").split("#")[0]).replace(/\//g, "\\");
}

/** Matches a * and ? pattern against a file's name (or its whole path, if the pattern has a slash). */
export function globMatches(pattern: string, filePath: string): boolean {
  const target = /[\\/]/.test(pattern) ? filePath.replace(/\//g, "\\") : filePath.split(/[\\/]/).pop() ?? "";
  const source = pattern
    .replace(/\//g, "\\")
    .split("")
    .map((ch) => (ch === "*" ? ".*" : ch === "?" ? "." : ch.replace(/[.+^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${source}$`, "i").test(target);
}

/** Short name for showing a schema location to people. */
export function schemaDisplayName(location: string): string {
  const withoutQuery = location.split(/[?#]/)[0];
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? location;
}
