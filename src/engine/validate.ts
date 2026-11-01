// Checks that go beyond "is this valid JSON?" — things a file can contain that are legal
// but almost always mistakes.
import type { JsonDocument } from "./document";
import { childrenOf, sourceOf, type Path } from "./nodes";
import type { Node } from "jsonc-parser";

export type ProblemSeverity = "error" | "warning";

export interface Problem {
  severity: ProblemSeverity;
  path: Path;
  message: string;
}

/** Largest integer JavaScript (and many JSON tools) can represent exactly: 2^53 - 1. */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function findProblems(doc: JsonDocument): Problem[] {
  const problems: Problem[] = [];
  walk(doc, doc.root, [], problems);
  return problems;
}

/** True if a number, as written, cannot be represented exactly by most JSON tools. */
export function isUnsafeNumber(numberText: string): boolean {
  if (!/^-?\d+$/.test(numberText)) return false; // decimals/exponents are approximate by nature
  const n = BigInt(numberText);
  return n > MAX_SAFE || n < -MAX_SAFE;
}

function walk(doc: JsonDocument, node: Node, path: Path, problems: Problem[]): void {
  if (node.type === "object") {
    const seen = new Set<string>();
    for (const { key } of childrenOf(node)) {
      const name = key as string;
      if (seen.has(name)) {
        problems.push({
          severity: "error",
          path: [...path, name],
          message: `Duplicate key "${name}": only the last one is used by most programs`,
        });
      }
      seen.add(name);
    }
  }
  if (node.type === "number" && isUnsafeNumber(sourceOf(doc, node))) {
    problems.push({
      severity: "warning",
      path,
      message: "This number is too large to be stored exactly by many programs",
    });
  }
  for (const child of childrenOf(node)) {
    walk(doc, child.node, [...path, child.key], problems);
  }
}
