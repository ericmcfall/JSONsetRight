import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import { parseDocument, toFileText, type JsonDocument } from "../document";
import { addProperty, duplicateChild, insertItem, moveChild, removeValue, renameKey, setNumberText, setValue } from "../edits";
import { formatDocument, removeTrailingCommas } from "../format";
import { findNode, valueOf } from "../nodes";
import { parseJson5 } from "./parse";

const lines = (...l: string[]) => l.join("\n") + "\n";

const SAMPLE = lines(
  "// Build settings",
  "{",
  "  name: 'my-app',",
  "  version: \"1.0.0\",",
  "  port: 0x1F90, // 8080",
  "  ratio: .5,",
  "  limits: { min: +1, max: Infinity, },",
  "  tags: ['a', 'b',],",
  "  'quoted-key': 'it\\'s',",
  "  multi: 'line one \\",
  "line two',",
  "}",
);

describe("JSON5 parser", () => {
  it("reads the same values as the official json5 package", () => {
    const inputs = [
      SAMPLE,
      "[1, -2, +3, .5, 5., 1e3, -Infinity, 0xff, '\\x41\\u0042', \"\\0\"]",
      "{a:{b:{c:[null,true,false]}},$d:1,_e:2,ünï:3}",
      "/* only */ 'just a string'",
      "{'a': 1, \"b\": 2, c: 3,}",
      "[]",
      "{}",
    ];
    for (const input of inputs) {
      const doc = parseDocument(input);
      expect(doc.dialect === "json5" || doc.dialect === "json" || doc.dialect === "jsonc").toBe(true);
      expect(valueOf(doc.root)).toEqual(JSON5.parse(input));
    }
  });

  it("reads NaN (which toEqual can't compare above)", () => {
    const value = valueOf(parseJson5("{n: NaN}").root) as { n: number };
    expect(Number.isNaN(value.n)).toBe(true);
  });

  it("rejects what JSON5 rejects", () => {
    for (const bad of ["{a b: 1}", "[01]", "['unclosed]", "{a: 1,,}", "[1 2]", "{1: 2}", "['\\1']", "[+]", "{a: 1} x", "/* open"]) {
      expect(() => JSON5.parse(bad)).toThrow();
      expect(() => parseJson5(bad)).toThrow();
    }
  });

  it("is only used when the file isn't plain JSON/JSONC", () => {
    expect(parseDocument('{"a": 1}').dialect).toBe("json");
    expect(parseDocument('{"a": 1, // x\n}').dialect).toBe("jsonc");
    expect(parseDocument(SAMPLE).dialect).toBe("json5");
  });

  it("reports the error from whichever reading got further", () => {
    expect(() => parseDocument("{a: 1, b: [1, 2,, 3]}")).toThrow(/line 1, column 17/);
  });

  it("round-trips byte-for-byte, including CRLF and BOM", () => {
    const text = "\uFEFF" + SAMPLE.replace(/\n/g, "\r\n");
    expect(toFileText(parseDocument(text))).toBe(text);
  });

  it("has exact offsets (tree positions match the text)", () => {
    const doc = parseDocument(SAMPLE);
    const port = findNode(doc, ["port"])!;
    expect(doc.text.slice(port.offset, port.offset + port.length)).toBe("0x1F90");
    expect(port.value).toBe(8080);
  });
});

describe("JSON5 edits keep the file's style", () => {
  const doc = () => parseDocument(SAMPLE);

  it("keeps single quotes when changing a string", () => {
    const next = setValue(doc(), ["name"], "it's new");
    expect(next.text).toContain("name: 'it\\'s new',");
  });

  it("keeps unquoted / quoted keys when renaming", () => {
    let next = renameKey(doc(), [], "port", "listenPort");
    expect(next.text).toContain("  listenPort: 0x1F90, // 8080");
    next = renameKey(next, [], "listenPort", "listen port");
    expect(next.text).toContain('  "listen port": 0x1F90');
    next = renameKey(doc(), [], "quoted-key", "other");
    expect(next.text).toContain("  'other': 'it\\'s',");
  });

  it("accepts JSON5 numbers in JSON5 files only", () => {
    expect(setNumberText(doc(), ["ratio"], "0xFF").text).toContain("ratio: 0xFF,");
    expect(() => setNumberText(parseDocument('{"a": 1}'), ["a"], "0xFF")).toThrow(/not a valid JSON number/);
  });

  it("adds properties in the object's key style and keeps trailing commas", () => {
    const next = addProperty(doc(), [], "debug", true);
    expect(next.text).toMatch(/multi: 'line one \\\nline two',\n  debug: true,\n}\n$/);
    const nested = addProperty(next, ["limits"], "step", 2);
    expect(nested.text).toContain("limits: { min: +1, max: Infinity, step: 2, },");
  });

  it("inserts and removes array items", () => {
    let next = insertItem(doc(), ["tags"], "first", 0);
    expect(next.text).toContain("tags: ['first', 'a', 'b',],"); // new string in the file's quote style
    next = removeValue(next, ["tags", 1]);
    expect(next.text).toContain("tags: ['first', 'b',],");
    next = removeValue(next, ["tags", 1]);
    next = removeValue(next, ["tags", 0]);
    expect(next.text).toContain("tags: [],");
  });

  it("removes a property with its line and its comment", () => {
    const next = removeValue(doc(), ["port"]);
    expect(next.text).not.toContain("port");
    expect(next.text).not.toContain("8080");
    expect(next.text).toContain("  version: \"1.0.0\",\n  ratio: .5,");
  });

  it("removes the last property when there is no trailing comma", () => {
    const next = removeValue(parseDocument("{\n  a: 1,\n  b: 2\n}"), ["b"]);
    expect(next.text).toBe("{\n  a: 1\n}");
  });

  it("writes new values in the file's style (unquoted keys, single quotes)", () => {
    const next = addProperty(doc(), ["limits"], "extra", { "a-b": "x", ok: ["y"] });
    expect(next.text).toContain("max: Infinity, extra: {\n    'a-b': 'x',\n    ok: [\n      'y'\n    ]\n  }, },");
  });

  it("fills an empty object on new lines", () => {
    const next = addProperty(parseDocument("{\n  a: {},\n}"), ["a"], "b", [1, 2]);
    expect(next.text).toBe("{\n  a: {\n    b: [\n      1,\n      2\n    ]\n  },\n}");
  });

  it("moves and duplicates, keeping the moved text exactly", () => {
    let next = moveChild(doc(), [], 2, 0); // port first
    expect(next.text.indexOf("port: 0x1F90")).toBeLessThan(next.text.indexOf("name:"));
    next = duplicateChild(doc(), ["tags"], 0).doc;
    expect(valueOf(findNode(next, ["tags"])!)).toEqual(["a", "a", "b"]);
  });

  it("leaves Format and trailing commas alone for JSON5", () => {
    expect(() => formatDocument(doc(), "  ")).toThrow(/isn't available for JSON5/);
    const original = doc();
    expect(removeTrailingCommas(original)).toBe(original);
  });
});

describe("JSON5 stress test", () => {
  it("stays valid JSON5 (checked by the official parser) across 400 random edits", () => {
    let seed = 7;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    let doc: JsonDocument = parseDocument(SAMPLE);
    const containers = (): (string | number)[][] => {
      const out: (string | number)[][] = [[]];
      const visit = (path: (string | number)[]) => {
        const node = findNode(doc, path)!;
        (node.children ?? []).forEach((child, i) => {
          const key = node.type === "object" ? (child.children![0].value as string) : i;
          const valueNode = node.type === "object" ? child.children![1] : child;
          if (valueNode.type === "object" || valueNode.type === "array") {
            out.push([...path, key]);
            visit([...path, key]);
          }
        });
      };
      visit([]);
      return out;
    };
    for (let i = 0; i < 400; i++) {
      const all = containers();
      const path = all[random(all.length)];
      const node = findNode(doc, path)!;
      const count = node.children?.length ?? 0;
      const op = random(4);
      if (op === 0 || count === 0) {
        const v = [1, "s'q", true, null, {}, [], { x: [1] }][random(7)] as never;
        doc = node.type === "object" ? addProperty(doc, path, `k${i}`, v, random(count + 1)) : insertItem(doc, path, v, random(count + 1));
      } else if (op === 1) {
        doc = moveChild(doc, path, random(count), random(count));
      } else if (op === 2 && count > 1) {
        const key = node.type === "object" ? (node.children![random(count)].children![0].value as string) : random(count);
        doc = removeValue(doc, [...path, key]);
      } else {
        doc = duplicateChild(doc, path, random(count)).doc;
      }
      expect(JSON5.parse(doc.text)).toEqual(valueOf(doc.root));
    }
  });
});
