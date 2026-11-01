import { describe, expect, it } from "vitest";
import { diffDocuments } from "./diff";
import { parseDocument } from "./document";

const diff = (a: string, b: string) =>
  diffDocuments(parseDocument(a), parseDocument(b)).map((d) => `${d.kind} ${JSON.stringify(d.leftPath)} ${JSON.stringify(d.rightPath)}`);

describe("diffDocuments", () => {
  it("ignores formatting, comments, key order and quote style", () => {
    expect(diff('{"a": 1, "b": [1, 2]}', "// note\n{\n  b: [1, 2.0],\n  'a': 1,\n}")).toEqual([]);
  });

  it("reports changed values, and keys only on one side", () => {
    expect(diff('{"a": 1, "b": 2, "c": {"d": true}}', '{"a": 1, "b": 3, "c": {"d": false, "e": null}, "f": 0}')).toEqual([
      'different ["b"] ["b"]',
      'different ["c","d"] ["c","d"]',
      'onlyRight ["c","e"] ["c","e"]',
      'onlyRight ["f"] ["f"]',
    ]);
    expect(diff('{"a": 1, "gone": 2}', '{"a": 1}')).toEqual(['onlyLeft ["gone"] ["gone"]']);
  });

  it("reports a type change as one difference", () => {
    expect(diff('{"a": {"x": 1}}', '{"a": [1]}')).toEqual(['different ["a"] ["a"]']);
  });

  it("lines lists up, so one insertion is one difference", () => {
    expect(diff('{"l": ["a", "b", "c"]}', '{"l": ["a", "new", "b", "c"]}')).toEqual(['onlyRight ["l",1] ["l",1]']);
    expect(diff('{"l": ["a", "b", "c"]}', '{"l": ["a", "c"]}')).toEqual(['onlyLeft ["l",1] ["l",1]']);
  });

  it("compares changed list items field by field", () => {
    const a = '{"users": [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]}';
    const b = '{"users": [{"id": 1, "name": "A"}, {"id": 2, "name": "Bee"}, {"id": 3, "name": "C"}]}';
    expect(diff(a, b)).toEqual(['different ["users",1,"name"] ["users",1,"name"]', 'onlyRight ["users",2] ["users",2]']);
  });

  it("compares big integers exactly as written", () => {
    expect(diff("[12345678901234567890]", "[12345678901234567891]")).toEqual(["different [0] [0]"]);
  });
});
