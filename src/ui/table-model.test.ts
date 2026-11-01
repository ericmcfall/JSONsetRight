import { describe, expect, it } from "vitest";
import { moveChild, parseDocument, valueOf } from "../engine";
import { buildTable, insertionIndexFor, isTableArray, movesFor, sortedOrder, tableTarget } from "./table-model";

const doc = parseDocument(
  JSON.stringify({
    users: [
      { name: "Cara", age: 31, admin: true },
      { name: "alex", age: 9, email: "a@x.io" },
      { name: "Bea", email: "b@x.io", age: 120, admin: false },
      { name: "Dan", age: "unknown" },
    ],
    mixed: [{ a: 1 }, 2],
    empty: [],
  }),
);

describe("table model", () => {
  it("only lists of objects become tables", () => {
    expect(isTableArray(doc.root.children![0].children![1])).toBe(true);
    expect(tableTarget(doc, ["users", 2, "email"])).toEqual(["users"]);
    expect(tableTarget(doc, ["mixed", 0])).toBeNull();
    expect(tableTarget(doc, ["empty"])).toBeNull();
  });

  it("collects columns in first-seen order with their usual kind", () => {
    const model = buildTable(doc, ["users"], ["notes"])!;
    expect(model.columns.map((c) => [c.key, c.count, c.kind])).toEqual([
      ["name", 4, "string"],
      ["age", 4, "number"],
      ["admin", 2, "boolean"],
      ["email", 2, "string"],
      ["notes", 0, "string"],
    ]);
    expect(model.rows[2].keys).toEqual(["name", "email", "age", "admin"]);
  });

  it("sorts for display: numbers by value, text naturally, missing last", () => {
    const model = buildTable(doc, ["users"])!;
    expect(sortedOrder(doc, model, "name", "asc")).toEqual([1, 2, 0, 3]); // alex, Bea, Cara, Dan
    expect(sortedOrder(doc, model, "email", "desc")).toEqual([2, 1, 0, 3]);
    expect(sortedOrder(doc, model, "admin", "asc")).toEqual([2, 0, 1, 3]);
  });

  it("puts a new key where the column order says", () => {
    const model = buildTable(doc, ["users"])!;
    expect(insertionIndexFor(model, model.rows[0], "email")).toBe(3); // after admin (end)
    expect(insertionIndexFor(model, model.rows[1], "admin")).toBe(2); // before email
    expect(insertionIndexFor(model, model.rows[3], "email")).toBe(2);
  });

  it("turns a display order into moves that reproduce it", () => {
    const order = [3, 0, 2, 1];
    let d = doc;
    for (const [from, to] of movesFor(order)) d = moveChild(d, ["users"], from, to);
    const names = (valueOf(d.root) as { users: { name: string }[] }).users.map((u) => u.name);
    expect(names).toEqual(["Dan", "Cara", "Bea", "alex"]);
    expect(movesFor([0, 1, 2])).toEqual([]);
  });
});
