import { describe, expect, it } from "vitest";
import {
  addProperty,
  changeType,
  describeTypeChangeLoss,
  duplicateChild,
  EditError,
  findNode,
  findProblems,
  formatDocument,
  formatPath,
  History,
  insertItem,
  JsonSyntaxError,
  moveChild,
  parseDocument,
  removeTrailingCommas,
  removeValue,
  renameKey,
  setNumberText,
  setValue,
  sourceOf,
  toFileText,
  valueOf,
  type JsonDocument,
} from "./index";

const value = (doc: JsonDocument) => valueOf(doc.root);
const lf = (lines: string[]) => lines.join("\n") + "\n";

const CONFIG = lf([
  "{",
  "  // Server settings",
  '  "port": 8080,',
  '  "host": "localhost", /* keep */',
  '  "tags": ["a", "b", "c"],',
  '  "nested": {',
  '    "on": true',
  "  }",
  "}",
]);

describe("parseDocument", () => {
  it("rejects invalid JSON with a line and column", () => {
    expect(() => parseDocument('{\n  "a": 1\n  "b": 2\n}')).toThrow(JsonSyntaxError);
    try {
      parseDocument('{\n  "a": 1\n  "b": 2\n}');
    } catch (e) {
      expect((e as JsonSyntaxError).problems[0]).toMatchObject({ line: 3, message: "Expected ','" });
    }
  });

  it("rejects an empty file", () => {
    expect(() => parseDocument("   ")).toThrow(JsonSyntaxError);
  });

  it("keeps a BOM and CRLF line endings on save", () => {
    const text = '﻿{\r\n  "a": 1\r\n}\r\n';
    const doc = parseDocument(text);
    expect(doc.format).toEqual({ indent: "  ", eol: "\r\n", bom: true });
    expect(toFileText(doc)).toBe(text);
  });
});

describe("setValue / setNumberText", () => {
  it("changes only the edited value; comments survive", () => {
    const doc = setValue(parseDocument(CONFIG), ["host"], 'my "server"');
    expect(doc.text).toBe(CONFIG.replace('"localhost"', '"my \\"server\\""'));
    expect(value(doc)).toMatchObject({ host: 'my "server"' });
  });

  it("escapes newlines and backslashes in strings automatically", () => {
    const doc = setValue(parseDocument(CONFIG), ["host"], "a\\b\nc");
    expect(value(doc)).toMatchObject({ host: "a\\b\nc" });
  });

  it("can set an object value", () => {
    const doc = setValue(parseDocument(CONFIG), ["nested"], { x: [1] });
    expect(value(doc)).toMatchObject({ nested: { x: [1] } });
    expect(doc.hasComments).toBe(true);
  });

  it("keeps numbers exactly as typed, including huge integers", () => {
    const doc = setNumberText(parseDocument(CONFIG), ["port"], "12345678901234567890");
    expect(doc.text).toContain('"port": 12345678901234567890,');
  });

  it("rejects text that is not a JSON number", () => {
    for (const bad of ["abc", "01", "1.", ".5", "+1", "NaN", "Infinity", "1e", ""]) {
      expect(() => setNumberText(parseDocument(CONFIG), ["port"], bad)).toThrow(EditError);
    }
  });

  it("throws not-found for a missing path", () => {
    expect(() => setValue(parseDocument(CONFIG), ["missing"], 1)).toThrow(/no longer exists/);
  });
});

describe("objects", () => {
  it("adds a property at the end or at a position", () => {
    let doc = addProperty(parseDocument(CONFIG), [], "debug", false);
    const keys = Object.keys(value(doc) as object);
    expect(keys[keys.length - 1]).toBe("debug");
    doc = addProperty(doc, [], "first", 1, 0);
    expect(Object.keys(value(doc) as object)[0]).toBe("first");
    expect(doc.hasComments).toBe(true);
  });

  it("matches the file's CRLF line endings and tab indentation", () => {
    const doc = addProperty(parseDocument('{\r\n\t"a": 1\r\n}\r\n'), [], "b", { c: [1] });
    expect(doc.text).not.toMatch(/[^\r]\n/);
    expect(doc.text).toContain('\r\n\t"b": {\r\n\t\t"c": [');
    expect(doc.text).not.toMatch(/^ +"/m);
  });

  it("blocks duplicate and empty keys", () => {
    const doc = parseDocument(CONFIG);
    expect(() => addProperty(doc, [], "port", 1)).toThrow(/already has a key/);
    expect(() => renameKey(doc, [], "host", "port")).toThrow(/already has a key/);
    expect(() => addProperty(doc, [], "", 1)).toThrow(/cannot be empty/);
  });

  it("renames a key without touching anything else", () => {
    const doc = renameKey(parseDocument(CONFIG), ["nested"], "on", "enabled");
    expect(doc.text).toBe(CONFIG.replace('"on"', '"enabled"'));
  });

  it("refuses to add a property to an array", () => {
    expect(() => addProperty(parseDocument(CONFIG), ["tags"], "x", 1)).toThrow(/Expected an object/);
  });
});

describe("arrays", () => {
  it("inserts at start, middle and end", () => {
    let doc = insertItem(parseDocument(CONFIG), ["tags"], "z");
    doc = insertItem(doc, ["tags"], "first", 0);
    doc = insertItem(doc, ["tags"], "mid", 2);
    expect(value(doc)).toMatchObject({ tags: ["first", "a", "mid", "b", "c", "z"] });
  });

  it("inserts into an empty array", () => {
    const doc = insertItem(parseDocument('{"list": []}'), ["list"], { a: 1 });
    expect(value(doc)).toEqual({ list: [{ a: 1 }] });
  });

  it("rejects out-of-range indexes", () => {
    expect(() => insertItem(parseDocument(CONFIG), ["tags"], 1, 9)).toThrow(EditError);
  });
});

describe("removeValue", () => {
  it("removes properties and items, keeping the file valid", () => {
    let doc = removeValue(parseDocument(CONFIG), ["tags", 1]);
    doc = removeValue(doc, ["nested"]);
    expect(value(doc)).toEqual({ port: 8080, host: "localhost", tags: ["a", "c"] });
  });

  it("cannot remove the root", () => {
    expect(() => removeValue(parseDocument(CONFIG), [])).toThrow(/cannot be deleted/);
  });
});

describe("moveChild", () => {
  it("reorders array items", () => {
    const doc = moveChild(parseDocument(CONFIG), ["tags"], 0, 2);
    expect(value(doc)).toMatchObject({ tags: ["b", "c", "a"] });
  });

  it("reorders object keys and keeps the moved value's exact text", () => {
    const text = lf(["{", '  "a": 1,', '  "b": {', "    // inner", '    "x": 1.50', "  }", "}"]);
    const doc = moveChild(parseDocument(text), [], 1, 0);
    expect(Object.keys(value(doc) as object)).toEqual(["b", "a"]);
    expect(doc.text).toContain("// inner");
    expect(doc.text).toContain("1.50");
  });
});

describe("duplicateChild", () => {
  it("duplicates array items after the original", () => {
    const { doc, key } = duplicateChild(parseDocument(CONFIG), ["tags"], 0);
    expect(key).toBe(1);
    expect(value(doc)).toMatchObject({ tags: ["a", "a", "b", "c"] });
  });

  it("gives duplicated keys a unique name", () => {
    let { doc } = duplicateChild(parseDocument(CONFIG), [], 0);
    ({ doc } = duplicateChild(doc, [], 0));
    expect(Object.keys(value(doc) as object).slice(0, 3)).toEqual(["port", "port copy 2", "port copy"]);
  });
});

describe("changeType", () => {
  it("converts values sensibly", () => {
    const doc = parseDocument('{"n": 5, "s": "42", "b": true, "o": {"x": 1}}');
    expect(value(changeType(doc, ["n"], "string"))).toMatchObject({ n: "5" });
    expect(value(changeType(doc, ["s"], "number"))).toMatchObject({ s: 42 });
    expect(value(changeType(doc, ["b"], "array"))).toMatchObject({ b: [true] });
    expect(value(changeType(doc, ["o"], "null"))).toMatchObject({ o: null });
  });

  it("warns only when data would be lost", () => {
    const doc = parseDocument('{"n": 5, "s": "hello", "o": {"x": 1, "y": 2}, "e": []}');
    expect(describeTypeChangeLoss(doc, ["n"], "string")).toBeNull();
    expect(describeTypeChangeLoss(doc, ["s"], "number")).toMatch(/"hello"/);
    expect(describeTypeChangeLoss(doc, ["o"], "string")).toMatch(/2 properties/);
    expect(describeTypeChangeLoss(doc, ["e"], "object")).toBeNull();
  });
});

describe("findProblems", () => {
  it("reports duplicate keys and unsafe numbers", () => {
    const doc = parseDocument('{"a": 1, "a": 2, "big": 9007199254740993, "ok": 1.5e300}');
    const problems = findProblems(doc);
    expect(problems.map((p) => p.severity)).toEqual(["error", "warning"]);
    expect(problems[0].path).toEqual(["a"]);
  });
});

describe("formatting", () => {
  it("re-indents but keeps comments", () => {
    const doc = formatDocument(parseDocument('{"a": [1, 2], // note\n"b": {"c": null}}\n'), "    ");
    expect(doc.text).toBe(lf(["{", '    "a": [', "        1,", "        2", "    ], // note", '    "b": {', '        "c": null', "    }", "}"]));
    expect(doc.format.indent).toBe("    ");
  });

  it("removes trailing commas", () => {
    const doc = removeTrailingCommas(parseDocument('{"a": [1, 2,], "b": 3, /* c */ }'));
    expect(doc.text).toBe('{"a": [1, 2], "b": 3 /* c */ }');
    expect(doc.hasTrailingCommas).toBe(false);
  });
});

describe("History", () => {
  it("undoes and redoes, and a new edit clears redo", () => {
    const h = new History("a");
    h.push("b");
    h.push("c");
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBe("a");
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe("b");
    h.push("x");
    expect(h.canRedo).toBe(false);
    expect(h.present).toBe("x");
  });
});

describe("helpers", () => {
  it("formats paths for display", () => {
    expect(formatPath([])).toBe("(root)");
    expect(formatPath(["Logging", "LogLevel", "Microsoft.AspNetCore"])).toBe('Logging.LogLevel["Microsoft.AspNetCore"]');
    expect(formatPath(["items", 0, "name"])).toBe("items[0].name");
  });

  it("reads source text exactly", () => {
    const doc = parseDocument('{"n": 1.50}');
    expect(sourceOf(doc, findNode(doc, ["n"])!)).toBe("1.50");
  });
});

/** Random edits must never produce invalid JSON (each one is re-parsed inside the engine). */
describe("stress: random edit sequences", () => {
  it("stays valid across 500 random edits", () => {
    let seed = 42;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    let doc = parseDocument(CONFIG);
    const pickContainer = (): (string | number)[] => {
      const paths: (string | number)[][] = [[]];
      const visit = (path: (string | number)[]) => {
        const node = findNode(doc, path)!;
        (node.children ?? []).forEach((child, i) => {
          const key = node.type === "object" ? (child.children![0].value as string) : i;
          const childNode = node.type === "object" ? child.children![1] : child;
          if (childNode.type === "object" || childNode.type === "array") {
            paths.push([...path, key]);
            visit([...path, key]);
          }
        });
      };
      visit([]);
      return paths[random(paths.length)];
    };
    for (let i = 0; i < 500; i++) {
      const path = pickContainer();
      const node = findNode(doc, path)!;
      const count = node.children?.length ?? 0;
      const op = random(4);
      if (op === 0 || count === 0) {
        const v = [1, "s", true, null, {}, []][random(6)] as never;
        doc = node.type === "object" ? addProperty(doc, path, `k${i}`, v) : insertItem(doc, path, v, random(count + 1));
      } else if (op === 1) {
        doc = moveChild(doc, path, random(count), random(count));
      } else if (op === 2 && count > 2) {
        const key = node.type === "object" ? (node.children![random(count)].children![0].value as string) : random(count);
        doc = removeValue(doc, [...path, key]);
      } else {
        doc = duplicateChild(doc, path, random(count)).doc;
      }
      expect(() => JSON.parse(doc.text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""))).not.toThrow();
    }
  });
});
