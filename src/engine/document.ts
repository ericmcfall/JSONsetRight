// The document model: a JSON/JSONC file's text plus its parsed syntax tree.
//
// JSONsetRight never edits parsed values and re-prints the file. It edits the *text* directly
// (see edits.ts) and re-parses afterwards, so comments, key order and formatting survive.
import {
  createScanner,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
  type SyntaxKind,
} from "jsonc-parser";
import { Json5SyntaxError, parseJson5 } from "./json5";
import { isTrivia, Token } from "./tokens";

/**
 * "json" = strict JSON. "jsonc" = the file had comments or trailing commas when opened.
 * "json5" = the file used JSON5 features (unquoted keys, single quotes, hex numbers, ...).
 */
export type Dialect = "json" | "jsonc" | "json5";

/** How the file was written, so edits and saves can match it. */
export interface FormatInfo {
  /** One level of indentation: "\t", "  ", "    ", ... */
  indent: string;
  eol: "\n" | "\r\n";
  /** Whether the file started with a UTF-8 byte order mark. */
  bom: boolean;
}

export interface SyntaxProblem {
  message: string;
  offset: number;
  /** 1-based, for showing to people. */
  line: number;
  column: number;
}

export interface JsonDocument {
  /** File text without the BOM. */
  readonly text: string;
  readonly root: Node;
  readonly dialect: Dialect;
  readonly hasComments: boolean;
  readonly hasTrailingCommas: boolean;
  readonly format: FormatInfo;
}

/** Thrown when text is not valid JSON/JSONC. */
export class JsonSyntaxError extends Error {
  readonly problems: SyntaxProblem[];

  constructor(problems: SyntaxProblem[]) {
    const first = problems[0];
    super(
      first
        ? `Invalid JSON at line ${first.line}, column ${first.column}: ${first.message}`
        : "Invalid JSON",
    );
    this.name = "JsonSyntaxError";
    this.problems = problems;
  }
}

const BOM = "\uFEFF";
const DEFAULT_INDENT = "  ";

/** Parses file text (which may start with a BOM). Throws JsonSyntaxError if it is not valid. */
export function parseDocument(fileText: string): JsonDocument {
  const bom = fileText.startsWith(BOM);
  const text = bom ? fileText.slice(1) : fileText;
  const format: FormatInfo = { indent: detectIndent(text), eol: detectEol(text), bom };
  try {
    const root = parseOrThrow(text);
    const scan = scanText(text);
    return {
      text,
      root,
      dialect: scan.hasComments || scan.hasTrailingCommas ? "jsonc" : "json",
      hasComments: scan.hasComments,
      hasTrailingCommas: scan.hasTrailingCommas,
      format,
    };
  } catch (jsoncError) {
    if (!(jsoncError instanceof JsonSyntaxError)) throw jsoncError;
    // Not JSON or JSONC; it may be JSON5.
    try {
      const result = parseJson5(text);
      return { text, root: result.root, dialect: "json5", hasComments: result.hasComments, hasTrailingCommas: result.hasTrailingCommas, format };
    } catch (json5Error) {
      if (!(json5Error instanceof Json5SyntaxError)) throw json5Error;
      // Report whichever reading got further into the file: that's usually where the mistake is.
      throw json5Error.problem.offset > jsoncError.problems[0].offset ? fromJson5Error(text, json5Error) : jsoncError;
    }
  }
}

/**
 * Returns a copy of the document with new text, keeping its dialect and format settings.
 * Throws JsonSyntaxError if the new text is invalid.
 */
export function withText(doc: JsonDocument, text: string): JsonDocument {
  if (doc.dialect === "json5") {
    try {
      const result = parseJson5(text);
      return { ...doc, text, root: result.root, hasComments: result.hasComments, hasTrailingCommas: result.hasTrailingCommas };
    } catch (error) {
      throw error instanceof Json5SyntaxError ? fromJson5Error(text, error) : error;
    }
  }
  const scan = scanText(text);
  return {
    ...doc,
    text,
    root: parseOrThrow(text),
    hasComments: scan.hasComments,
    hasTrailingCommas: scan.hasTrailingCommas,
  };
}

function fromJson5Error(text: string, error: Json5SyntaxError): JsonSyntaxError {
  const { message, offset } = error.problem;
  return new JsonSyntaxError([{ message, offset, ...lineAndColumn(text, offset) }]);
}

/** The exact text to write to disk (BOM restored if the original had one). */
export function toFileText(doc: JsonDocument): string {
  return doc.format.bom ? BOM + doc.text : doc.text;
}

/** Converts a character offset to a 1-based line and column. */
export function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function parseOrThrow(text: string): Node {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });
  if (errors.length > 0 || !root) {
    const problems = errors.map((e) => ({
      message: describeParseError(e),
      offset: e.offset,
      ...lineAndColumn(text, e.offset),
    }));
    if (problems.length === 0) {
      problems.push({ message: "The file is empty", offset: 0, line: 1, column: 1 });
    }
    throw new JsonSyntaxError(problems);
  }
  return root;
}

function describeParseError(error: ParseError): string {
  const messages: Record<string, string> = {
    InvalidSymbol: "Unexpected character",
    InvalidNumberFormat: "Invalid number",
    PropertyNameExpected: "Expected a property name in double quotes",
    ValueExpected: "Expected a value",
    ColonExpected: "Expected ':'",
    CommaExpected: "Expected ','",
    CloseBraceExpected: "Expected '}'",
    CloseBracketExpected: "Expected ']'",
    EndOfFileExpected: "Unexpected content after the end of the JSON",
    InvalidCommentToken: "Invalid comment",
    UnexpectedEndOfComment: "Comment is not closed",
    UnexpectedEndOfString: "String is not closed",
    UnexpectedEndOfNumber: "Number is incomplete",
    InvalidUnicode: "Invalid \\u escape",
    InvalidEscapeCharacter: "Invalid escape character",
    InvalidCharacter: "Invalid character in string",
  };
  const code = printParseErrorCode(error.error);
  return messages[code] ?? code;
}

/** Walks the tokens once to find comments and trailing commas (a comma right before } or ]). */
function scanText(text: string): { hasComments: boolean; hasTrailingCommas: boolean } {
  const scanner = createScanner(text, false);
  let hasComments = false;
  let hasTrailingCommas = false;
  let lastSignificant: SyntaxKind | undefined;
  for (let token = scanner.scan(); token !== Token.EOF; token = scanner.scan()) {
    if (token === Token.LineComment || token === Token.BlockComment) hasComments = true;
    if (isTrivia(token)) continue;
    if ((token === Token.CloseBrace || token === Token.CloseBracket) && lastSignificant === Token.Comma) {
      hasTrailingCommas = true;
    }
    lastSignificant = token;
  }
  return { hasComments, hasTrailingCommas };
}

/**
 * For files that were strict JSON when opened: the first comment or trailing comma in `text`,
 * since adding those would make the file unreadable by programs that expect standard JSON.
 */
export function findStrictJsonViolation(text: string): SyntaxProblem | null {
  const scanner = createScanner(text, false);
  let lastComma: number | null = null;
  for (let token = scanner.scan(); token !== Token.EOF; token = scanner.scan()) {
    const offset = scanner.getTokenOffset();
    if (token === Token.LineComment || token === Token.BlockComment) {
      return { message: "Comments aren't allowed in this file, because it is standard JSON", offset, ...lineAndColumn(text, offset) };
    }
    if (isTrivia(token)) continue;
    if ((token === Token.CloseBrace || token === Token.CloseBracket) && lastComma !== null) {
      return { message: "A comma before a closing bracket isn't allowed in standard JSON", offset: lastComma, ...lineAndColumn(text, lastComma) };
    }
    lastComma = token === Token.Comma ? offset : null;
  }
  return null;
}

function detectEol(text: string): "\n" | "\r\n" {
  const lf = text.indexOf("\n");
  if (lf === -1) return "\r\n"; // single-line file: use the Windows default for new lines
  return lf > 0 && text[lf - 1] === "\r" ? "\r\n" : "\n";
}

/** Uses the first indented line, which in normal JSON is one level deep. */
function detectIndent(text: string): string {
  for (const line of text.split("\n")) {
    const match = /^([ \t]+)\S/.exec(line);
    if (match) {
      return match[1].startsWith("\t") ? "\t" : match[1];
    }
  }
  return DEFAULT_INDENT;
}
