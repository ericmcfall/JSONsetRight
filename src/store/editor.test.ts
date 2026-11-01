// Store logic with a fake file system (the real one needs the desktop app).
import { beforeEach, describe, expect, it, vi } from "vitest";

const disk = new Map<string, { text: string; modifiedMs: number }>();
const confirmAnswers: boolean[] = [];

vi.mock("../platform/files", () => ({
  fileNameOf: (p: string) => p.split(/[\\/]/).pop(),
  readTextFile: async (p: string) => {
    const f = disk.get(p);
    if (!f) throw new Error("not found");
    return { ...f };
  },
  saveTextFile: async (p: string, text: string) => {
    const modifiedMs = (disk.get(p)?.modifiedMs ?? 0) + 1;
    disk.set(p, { text, modifiedMs });
    return modifiedMs;
  },
  fileModifiedMs: async (p: string) => disk.get(p)?.modifiedMs ?? null,
  pickFilesToOpen: async () => [],
  pickSavePath: async () => null,
}));
vi.mock("../ui/dialog", () => ({
  confirmDialog: async () => confirmAnswers.shift() ?? false,
  askDialog: async () => ((confirmAnswers.shift() ?? false) ? "confirm" : "cancel"),
}));
vi.mock("./schemas", () => ({ schemaProblems: () => schemaProblemList, forgetTabSchema: () => undefined }));
let schemaProblemList: { path: (string | number)[]; message: string }[] = [];

const { useEditor, isDirty } = await import("./editor");
const { setValue } = await import("../engine");

const PATH = "C:\\cfg\\app.json";
const s = () => useEditor.getState();
const tab = () => s().tabs.find((t) => t.id === s().activeId)!;

beforeEach(() => {
  disk.clear();
  confirmAnswers.length = 0;
  useEditor.setState({ tabs: [], activeId: null, message: null });
  disk.set(PATH, { text: '{\n  "a": 1\n}\n', modifiedMs: 100 });
});

describe("editor store", () => {
  it("opens, edits, saves and tracks unsaved changes", async () => {
    await s().openFiles([PATH]);
    expect(isDirty(tab())).toBe(false);
    s().apply((doc) => setValue(doc, ["a"], 2));
    expect(isDirty(tab())).toBe(true);
    expect(await s().save()).toBe(true);
    expect(disk.get(PATH)!.text).toBe('{\n  "a": 2\n}\n');
    expect(isDirty(tab())).toBe(false);
  });

  it("opening the same file twice just switches to its tab", async () => {
    await s().openFiles([PATH]);
    await s().openFiles([PATH.toUpperCase()]);
    expect(s().tabs.length).toBe(1);
  });

  it("opens invalid files in text mode, blocks saving, and switches to the tree once fixed", async () => {
    disk.set("C:\\bad.json", { text: '\uFEFF{"a": 1,, }', modifiedMs: 1 });
    await s().openFiles(["C:\\bad.json"]);
    expect(tab()).toMatchObject({ view: "text", placeholder: true });
    expect(s().message?.text).toMatch(/isn't valid JSON yet \(line 1/);
    expect(s().setView("tree")).toBe(false);
    expect(await s().save()).toBe(false);

    s().applyText(tab().id, '{"a": 1, "b": 2}');
    expect(tab()).toMatchObject({ placeholder: false, pendingText: null });
    expect(tab().history.past.length).toBe(0); // the stand-in isn't an undo step
    expect(s().setView("tree")).toBe(true);
    expect(await s().save()).toBe(true);
    expect(disk.get("C:\\bad.json")!.text).toBe('\uFEFF{"a": 1, "b": 2}'); // BOM kept
  });

  it("applies valid text as one undo step and keeps invalid text pending", async () => {
    await s().openFiles([PATH]);
    s().setView("text");
    s().applyText(tab().id, '{\n  "a": 1,\n  "b": [1, 2]\n}\n');
    expect(tab().history.past.length).toBe(1);
    s().applyText(tab().id, '{\n  "a": 1,\n  "b": [1, 2\n}\n');
    expect(tab().pendingText?.problem.line).toBe(4);
    expect(isDirty(tab())).toBe(true);
    s().undo(); // discards the invalid text too
    expect(tab().pendingText).toBeNull();
    expect(tab().history.present.text).toBe('{\n  "a": 1\n}\n');
  });

  it("keeps standard JSON files free of comments and trailing commas", async () => {
    await s().openFiles([PATH]);
    s().applyText(tab().id, '{\n  // note\n  "a": 1\n}\n');
    expect(tab().pendingText?.problem).toMatchObject({ line: 2, message: expect.stringMatching(/Comments aren't allowed/) });
    s().applyText(tab().id, '{\n  "a": 1,\n}\n');
    expect(tab().pendingText?.problem.message).toMatch(/comma before a closing bracket/);
  });

  it("asks before overwriting changes made by another program", async () => {
    await s().openFiles([PATH]);
    s().apply((doc) => setValue(doc, ["a"], 2));
    disk.set(PATH, { text: '{"a": 99}', modifiedMs: 200 }); // someone else saved

    confirmAnswers.push(false);
    expect(await s().save()).toBe(false);
    expect(disk.get(PATH)!.text).toBe('{"a": 99}');

    confirmAnswers.push(true);
    expect(await s().save()).toBe(true);
    expect(disk.get(PATH)!.text).toContain('"a": 2');
  });

  it("removes trailing commas on save when that setting is on (undoable)", async () => {
    const { useSettings } = await import("./settings");
    disk.set(PATH, { text: '{"a": [1, 2,],}', modifiedMs: 100 });
    await s().openFiles([PATH]);
    useSettings.setState({ trailingCommas: "remove" });
    expect(await s().save()).toBe(true);
    expect(disk.get(PATH)!.text).toBe('{"a": [1, 2]}');
    s().undo();
    expect(tab().history.present.text).toBe('{"a": [1, 2,],}');
    useSettings.setState({ trailingCommas: "keep" });
  });

  it("warns about schema problems on save, but lets the user save anyway", async () => {
    await s().openFiles([PATH]);
    s().apply((doc) => setValue(doc, ["a"], 2));
    schemaProblemList = [{ path: ["a"], message: "Must be <= 1" }];
    confirmAnswers.push(false);
    expect(await s().save()).toBe(false);
    expect(disk.get(PATH)!.text).toContain('"a": 1');
    confirmAnswers.push(true);
    expect(await s().save()).toBe(true);
    expect(disk.get(PATH)!.text).toContain('"a": 2');
    schemaProblemList = [];
  });

  it("reloads from disk as an undoable step", async () => {
    await s().openFiles([PATH]);
    s().reloadFromDisk(tab().id, '{"a": 5}', 300);
    expect(tab().history.present.text).toBe('{"a": 5}');
    expect(isDirty(tab())).toBe(false);
    s().undo();
    expect(tab().history.present.text).toBe('{\n  "a": 1\n}\n');
  });

  it("keeps the open version if the outside change is invalid JSON", async () => {
    await s().openFiles([PATH]);
    s().reloadFromDisk(tab().id, '{"a": ', 300);
    expect(tab().history.present.text).toBe('{\n  "a": 1\n}\n');
    expect(s().message?.text).toMatch(/isn't valid JSON/);
  });

  it("reports refused edits instead of applying them", async () => {
    await s().openFiles([PATH]);
    const { addProperty } = await import("../engine");
    expect(s().apply((doc) => addProperty(doc, [], "a", 1))).toBe(false);
    expect(s().message?.text).toMatch(/already has a key/);
    expect(tab().history.past.length).toBe(0);
  });
});
