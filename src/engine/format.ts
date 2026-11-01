// Whole-document formatting commands. Normal edits never reformat the file; these run only
// when the user asks (Format document) or when a save setting requires it (trailing commas).
import { applyEdits, createScanner, format, type Edit } from "jsonc-parser";
import { withText, type JsonDocument } from "./document";
import { EditError } from "./edits";
import { isTrivia, Token } from "./tokens";

/** Re-indents the whole document. `indent` is "\t" or a run of spaces. Comments are kept. */
export function formatDocument(doc: JsonDocument, indent: string): JsonDocument {
  if (doc.dialect === "json5") {
    throw new EditError("not-supported", "Format isn't available for JSON5 files yet. Edits still keep the file's layout.");
  }
  const tabs = indent === "\t";
  const edits = format(doc.text, undefined, {
    insertSpaces: !tabs,
    tabSize: tabs ? 4 : indent.length,
    eol: doc.format.eol,
    insertFinalNewline: /\r?\n$/.test(doc.text),
    keepLines: false,
  });
  const formatted = withText(doc, applyEdits(doc.text, edits));
  return { ...formatted, format: { ...formatted.format, indent } };
}

/** Removes commas that come right before a closing } or ]. */
export function removeTrailingCommas(doc: JsonDocument): JsonDocument {
  // Trailing commas are a normal part of JSON5, so JSON5 files keep them.
  if (!doc.hasTrailingCommas || doc.dialect === "json5") return doc;
  const scanner = createScanner(doc.text, false);
  const edits: Edit[] = [];
  let pendingComma: { offset: number } | undefined;
  for (let token = scanner.scan(); token !== Token.EOF; token = scanner.scan()) {
    if (isTrivia(token)) continue;
    if (pendingComma && (token === Token.CloseBrace || token === Token.CloseBracket)) {
      edits.push({ offset: pendingComma.offset, length: 1, content: "" });
    }
    pendingComma = token === Token.Comma ? { offset: scanner.getTokenOffset() } : undefined;
  }
  return withText(doc, applyEdits(doc.text, edits));
}
