// All problems for a document: SafeJSON's own checks plus schema validation.
import { findProblems, type JsonDocument, type Problem } from "../engine";
import { schemaProblems } from "../store/schemas";
import { pathKey } from "./tree-model";

export interface ShownProblem extends Problem {
  source: "SafeJSON" | "Schema";
}

export function allProblems(tabId: string, doc: JsonDocument): ShownProblem[] {
  return [
    ...findProblems(doc).map((p) => ({ ...p, source: "SafeJSON" as const })),
    ...schemaProblems(tabId, doc).map((p) => ({ ...p, severity: "error" as const, source: "Schema" as const })),
  ];
}

/** Problems grouped by tree path, for markers on rows. */
export function problemsByPath(problems: ShownProblem[]): Map<string, ShownProblem[]> {
  const map = new Map<string, ShownProblem[]>();
  for (const p of problems) {
    const key = pathKey(p.path);
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return map;
}
