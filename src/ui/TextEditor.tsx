// Text mode: the whole file in a code editor, for people who prefer typing JSON.
// What you type is applied to the document once it's valid (each pause in typing is one undo
// step). While it isn't valid, a banner shows where the problem is, and saving and the tree
// view are blocked until it's fixed.
import { useEffect, useRef, useState } from "react";
import { findNode } from "../engine";
import { setTextEditorFlush, useEditor, type Tab } from "../store/editor";
import { useTabSchema } from "../store/schemas";

type Setup = typeof import("./monaco-setup");
type Model = import("monaco-editor/editor/editor.api").editor.ITextModel;
type Editor = import("monaco-editor/editor/editor.api").editor.IStandaloneCodeEditor;

const APPLY_DELAY_MS = 400;

// One Monaco text model per tab, so each tab keeps its own cursor and Monaco undo history.
const models = new Map<string, Model>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let syncing = false; // true while SafeJSON itself changes the text (not the person typing)

function applyNow(tabId: string) {
  const timer = timers.get(tabId);
  if (timer === undefined) return;
  clearTimeout(timer);
  timers.delete(tabId);
  const model = models.get(tabId);
  if (model) useEditor.getState().applyText(tabId, model.getValue());
}

function flushAll() {
  for (const tabId of [...timers.keys()]) applyNow(tabId);
}

const textOf = (tab: Tab) => tab.pendingText?.text ?? tab.history.present.text;

function modelFor(setup: Setup, tab: Tab): Model {
  let model = models.get(tab.id);
  if (!model) {
    const { monaco } = setup;
    model = monaco.editor.createModel(textOf(tab), "json", monaco.Uri.parse(`inmemory://safejson/${tab.id}.json`));
    model.setEOL(tab.history.present.format.eol === "\r\n" ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
    const tabId = tab.id;
    model.onDidChangeContent(() => {
      if (syncing) return;
      clearTimeout(timers.get(tabId));
      timers.set(tabId, setTimeout(() => applyNow(tabId), APPLY_DELAY_MS));
    });
    models.set(tab.id, model);
  }
  return model;
}

export function TextEditor({ tab }: { tab: Tab }) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const tabIds = useEditor((s) => s.tabs.map((t) => t.id).join(","));
  const schema = useTabSchema(tab.id);
  const doc = tab.history.present;

  // Load Monaco on first use.
  useEffect(() => {
    let alive = true;
    import("./monaco-setup").then((m) => alive && setSetup(m));
    return () => {
      alive = false;
    };
  }, []);

  // Create the editor once Monaco has loaded.
  useEffect(() => {
    if (!setup || !host.current) return;
    const { monaco } = setup;
    const themeFor = () => (document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs");
    const instance = monaco.editor.create(host.current, {
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: '"Cascadia Code", Consolas, monospace',
      fontSize: 13,
      scrollBeyondLastLine: false,
      theme: themeFor(),
      formatOnPaste: false,
    });
    editor.current = instance;
    setTextEditorFlush(flushAll);
    // Follow light/dark theme changes.
    const observer = new MutationObserver(() => monaco.editor.setTheme(themeFor()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // Apply what was typed when focus leaves the editor (e.g. clicking Save or Tree).
    const blur = instance.onDidBlurEditorText(flushAll);
    return () => {
      flushAll();
      blur.dispose();
      observer.disconnect();
      setTextEditorFlush(null);
      instance.dispose();
      editor.current = null;
    };
  }, [setup]);

  // Show the active tab's text, with its indentation settings.
  useEffect(() => {
    if (!setup || !editor.current) return;
    const model = modelFor(setup, tab);
    const indent = doc.format.indent;
    model.updateOptions({ insertSpaces: indent !== "\t", tabSize: indent === "\t" ? 4 : indent.length });
    if (editor.current.getModel() !== model) editor.current.setModel(model);
  }, [setup, tab.id, doc.format.indent]); // eslint-disable-line react-hooks/exhaustive-deps -- `tab` is read only to create the model

  // Keep the editor in step with changes made elsewhere (undo, reload from disk, backups).
  const wanted = textOf(tab);
  useEffect(() => {
    const model = models.get(tab.id);
    if (!model || timers.has(tab.id)) return; // don't overwrite what's being typed
    const eol = model.getEOL();
    const normalized = wanted.replace(/\r?\n/g, eol);
    if (model.getValue() === normalized) return;
    syncing = true;
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: normalized }], () => null);
    syncing = false;
  }, [tab.id, wanted, setup]);

  // Schema-aware completion and checking inside the editor.
  useEffect(() => {
    if (!setup) return;
    const compiled = schema.compiled;
    const modelUri = `inmemory://safejson/${tab.id}.json`;
    const lenient = tab.placeholder || doc.dialect === "jsonc";
    setup.jsonDefaults.setDiagnosticsOptions({
      // The JSON checker doesn't understand JSON5, so JSON5 files rely on SafeJSON's own check.
      validate: doc.dialect !== "json5",
      allowComments: lenient,
      trailingCommas: lenient ? "ignore" : "error",
      enableSchemaRequest: false,
      schemaRequest: "ignore",
      schemas: compiled
        ? [...compiled.documents].map(([uri, schemaDoc]) => ({
            uri,
            schema: schemaDoc,
            fileMatch: uri === compiled.baseUri ? [modelUri] : undefined,
          }))
        : [],
    });
  }, [setup, tab.id, schema.compiled, doc.dialect, tab.placeholder]);

  // Selecting something elsewhere (e.g. in the Problems panel) jumps to it in the text.
  useEffect(() => {
    const model = models.get(tab.id);
    const node = tab.pendingText ? undefined : findNode(doc, tab.selectedPath);
    if (!model || !editor.current || !node || tab.selectedPath.length === 0) return;
    const position = model.getPositionAt(node.offset);
    editor.current.setPosition(position);
    editor.current.revealPositionInCenterIfOutsideViewport(position);
  }, [tab.selectedPath, setup]); // eslint-disable-line react-hooks/exhaustive-deps -- only jump when the selection changes

  // Throw away models of closed tabs.
  useEffect(() => {
    const open = new Set(tabIds.split(","));
    for (const [id, model] of models) {
      if (!open.has(id)) {
        model.dispose();
        models.delete(id);
        clearTimeout(timers.get(id));
        timers.delete(id);
      }
    }
  }, [tabIds]);

  const problem = tab.pendingText?.problem;
  const goToProblem = () => {
    if (!problem || !editor.current) return;
    const position = { lineNumber: problem.line, column: problem.column };
    editor.current.setPosition(position);
    editor.current.revealPositionInCenter(position);
    editor.current.focus();
  };

  return (
    <div className="text-mode">
      {problem && (
        <div className="text-problem" role="alert">
          <span>
            ⛔ Line {problem.line}, column {problem.column}: {problem.message}. Fix this to save or to use the tree.
          </span>
          <button type="button" onClick={goToProblem}>Go to problem</button>
        </div>
      )}
      {!setup && <div className="text-loading">Loading the text editor…</div>}
      <div className="text-host" ref={host} />
    </div>
  );
}
