// A JSON5 parser (https://spec.json5.org) that builds the same syntax tree as jsonc-parser,
// with exact text offsets, so the rest of the engine works on JSON5 files unchanged.
//
// JSON5 adds to JSON: comments, trailing commas, unquoted keys, single-quoted strings,
// multi-line strings, hex numbers, leading/trailing decimal points, +signs, Infinity and NaN.
import type { Node } from "jsonc-parser";

export interface Json5Problem {
  message: string;
  offset: number;
}

export class Json5SyntaxError extends Error {
  readonly problem: Json5Problem;

  constructor(problem: Json5Problem) {
    super(problem.message);
    this.problem = problem;
  }
}

export interface Json5Result {
  root: Node;
  hasComments: boolean;
  hasTrailingCommas: boolean;
}

/** jsonc-parser's Node is read-only; the parser fills nodes in as it goes. */
type Draft = { -readonly [K in keyof Node]: Node[K] };

const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$_\u200C\u200D]/u;
const LINE_BREAK = /[\n\r\u2028\u2029]/;
const SPACE = /[\t\v\f \u00A0\uFEFF\p{Zs}]/u;

export function parseJson5(text: string): Json5Result {
  let pos = 0;
  let hasComments = false;
  let hasTrailingCommas = false;

  const fail = (message: string, at = pos): never => {
    throw new Json5SyntaxError({ message, offset: at });
  };

  /** Skips spaces, line breaks and comments. */
  const skip = () => {
    while (pos < text.length) {
      const ch = text[pos];
      if (SPACE.test(ch) || LINE_BREAK.test(ch)) {
        pos++;
      } else if (ch === "/" && text[pos + 1] === "/") {
        hasComments = true;
        while (pos < text.length && !LINE_BREAK.test(text[pos])) pos++;
      } else if (ch === "/" && text[pos + 1] === "*") {
        hasComments = true;
        const end = text.indexOf("*/", pos + 2);
        if (end === -1) fail("Comment is not closed");
        pos = end + 2;
      } else {
        return;
      }
    }
  };

  const value = (parent: Node | undefined): Node => {
    skip();
    const ch = text[pos];
    if (ch === undefined) fail("Expected a value");
    if (ch === "{") return object(parent);
    if (ch === "[") return array(parent);
    if (ch === '"' || ch === "'") {
      const start = pos;
      const decoded = string();
      return { type: "string", offset: start, length: pos - start, value: decoded, parent };
    }
    if (/[-+.\dIN]/.test(ch)) return number(parent);
    for (const [word, type, literal] of [["true", "boolean", true], ["false", "boolean", false], ["null", "null", null]] as const) {
      if (text.startsWith(word, pos) && !ID_PART.test(text[pos + word.length] ?? "")) {
        const start = pos;
        pos += word.length;
        return { type, offset: start, length: word.length, value: literal, parent };
      }
    }
    return fail(`Unexpected character "${ch}"`);
  };

  const object = (parent: Node | undefined): Node => {
    const node: Draft = { type: "object", offset: pos, length: 0, children: [], parent };
    pos++; // {
    skip();
    while (text[pos] !== "}") {
      const property: Draft = { type: "property", offset: pos, length: 0, children: [], parent: node };
      const keyStart = pos;
      const key = text[pos] === '"' || text[pos] === "'" ? string() : identifier();
      property.children!.push({ type: "string", offset: keyStart, length: pos - keyStart, value: key, parent: property });
      skip();
      if (text[pos] !== ":") fail("Expected ':'");
      property.colonOffset = pos;
      pos++;
      const child = value(property);
      property.children!.push(child);
      property.length = child.offset + child.length - property.offset;
      node.children!.push(property);
      skip();
      if (text[pos] === ",") {
        pos++;
        skip();
        if (text[pos] === "}") hasTrailingCommas = true;
      } else if (text[pos] !== "}") {
        fail(pos >= text.length ? "Expected '}'" : "Expected ','");
      }
    }
    pos++; // }
    node.length = pos - node.offset;
    return node;
  };

  const array = (parent: Node | undefined): Node => {
    const node: Draft = { type: "array", offset: pos, length: 0, children: [], parent };
    pos++; // [
    skip();
    while (text[pos] !== "]") {
      node.children!.push(value(node));
      skip();
      if (text[pos] === ",") {
        pos++;
        skip();
        if (text[pos] === "]") hasTrailingCommas = true;
      } else if (text[pos] !== "]") {
        fail(pos >= text.length ? "Expected ']'" : "Expected ','");
      }
    }
    pos++; // ]
    node.length = pos - node.offset;
    return node;
  };

  const identifier = (): string => {
    const start = pos;
    if (!ID_START.test(text[pos] ?? "")) fail("Expected a property name");
    pos++;
    while (pos < text.length && ID_PART.test(text[pos])) pos++;
    return text.slice(start, pos);
  };

  const string = (): string => {
    const quote = text[pos];
    const start = pos;
    pos++;
    let out = "";
    while (true) {
      const ch = text[pos];
      if (ch === undefined) fail("String is not closed", start);
      if (ch === quote) {
        pos++;
        return out;
      }
      if (ch === "\n" || ch === "\r") fail("String is not closed", start);
      if (ch !== "\\") {
        out += ch;
        pos++;
        continue;
      }
      // Escape sequences
      const next = text[pos + 1];
      pos += 2;
      switch (next) {
        case "b": out += "\b"; break;
        case "f": out += "\f"; break;
        case "n": out += "\n"; break;
        case "r": out += "\r"; break;
        case "t": out += "\t"; break;
        case "v": out += "\v"; break;
        case "0":
          if (/\d/.test(text[pos] ?? "")) fail("Invalid escape character", pos - 2);
          out += "\0";
          break;
        case "x": {
          const hex = text.slice(pos, pos + 2);
          if (!/^[0-9a-fA-F]{2}$/.test(hex)) fail("Invalid \\x escape", pos - 2);
          out += String.fromCharCode(parseInt(hex, 16));
          pos += 2;
          break;
        }
        case "u": {
          const hex = text.slice(pos, pos + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("Invalid \\u escape", pos - 2);
          out += String.fromCharCode(parseInt(hex, 16));
          pos += 4;
          break;
        }
        case "\r":
          if (text[pos] === "\n") pos++; // line continuation
          break;
        case "\n": case "\u2028": case "\u2029":
          break; // line continuation
        case undefined:
          fail("String is not closed", start);
          break;
        default:
          if (/[1-9]/.test(next)) fail("Invalid escape character", pos - 2);
          out += next; // \' \" \\ \/ and any other character stand for themselves
      }
    }
  };

  const number = (parent: Node | undefined): Node => {
    const start = pos;
    const match = /^[+-]?(Infinity|NaN|0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(text.slice(pos));
    if (!match) return fail("Invalid number");
    pos += match[0].length;
    if (ID_PART.test(text[pos] ?? "")) fail("Invalid number");
    if (/^[+-]?0\d/.test(match[0])) fail("Numbers can't have leading zeros", start);
    return { type: "number", offset: start, length: pos - start, value: numberValue(match[0]), parent };
  };

  const root = value(undefined);
  skip();
  if (pos < text.length) fail("Unexpected content after the end of the data");
  return { root, hasComments, hasTrailingCommas };
}

export function numberValue(source: string): number {
  const sign = source.startsWith("-") ? -1 : 1;
  const body = source.replace(/^[+-]/, "");
  if (/^0[xX]/.test(body)) return sign * parseInt(body.slice(2), 16);
  return sign * Number(body); // Number() understands Infinity, NaN, ".5" and "5."
}

/** True if a key can be written without quotes in JSON5. */
export function isIdentifier(key: string): boolean {
  if (key === "" || !ID_START.test(key[0])) return false;
  for (const ch of key.slice(1)) if (!ID_PART.test(ch)) return false;
  return true;
}
