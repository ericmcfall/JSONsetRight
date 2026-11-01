// Which schema each open tab uses, its loading state, and the validation results.
import { create } from "zustand";
import type { JsonDocument } from "../engine";
import {
  compileSchema,
  findSchemaSource,
  type CompiledSchema,
  type SchemaProblem,
  type SchemaSource,
} from "../engine/schema";
import { loadSchemaText } from "../platform/files";
import type { Tab } from "./editor";
import { useSettings } from "./settings";

export interface TabSchema {
  source: SchemaSource | null;
  status: "none" | "loading" | "ready" | "error";
  error?: string;
  compiled?: CompiledSchema;
}

interface SchemaState {
  byTab: Record<string, TabSchema>;
}

export const useSchemas = create<SchemaState>(() => ({ byTab: {} }));

/** Compiled schemas by location, shared by tabs that use the same schema. */
const compiled = new Map<string, Promise<CompiledSchema>>();

const NO_SCHEMA: TabSchema = { source: null, status: "none" };

export function schemaFor(tabId: string): TabSchema {
  return useSchemas.getState().byTab[tabId] ?? NO_SCHEMA;
}

export function useTabSchema(tabId: string | undefined): TabSchema {
  return useSchemas((s) => (tabId ? s.byTab[tabId] : undefined) ?? NO_SCHEMA);
}

/**
 * Works out which schema a tab should use and loads it if that changed.
 * `refresh` re-reads the schema files and re-downloads web schemas.
 */
export async function updateTabSchema(tab: Tab, refresh = false): Promise<void> {
  const { schemaPairs, schemaRules } = useSettings.getState();
  const source = findSchemaSource(tab.history.present, tab.filePath, schemaPairs, schemaRules);
  const current = schemaFor(tab.id);
  if (!refresh && current.source?.location === source?.location && current.source?.kind === source?.kind) return;

  const setTab = (state: TabSchema) => useSchemas.setState((s) => ({ byTab: { ...s.byTab, [tab.id]: state } }));
  if (!source) return setTab(NO_SCHEMA);

  setTab({ source, status: "loading" });
  if (refresh) compiled.delete(source.location);
  let promise = compiled.get(source.location);
  if (!promise) {
    promise = compileSchema(source.location, (location) => loadSchemaText(location, refresh));
    compiled.set(source.location, promise);
  }
  try {
    const result = await promise;
    // Ignore the result if the tab switched to another schema while this one loaded.
    if (schemaFor(tab.id).source?.location === source.location) setTab({ source, status: "ready", compiled: result });
  } catch (error) {
    compiled.delete(source.location); // try again next time
    if (schemaFor(tab.id).source?.location === source.location) {
      setTab({ source, status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export function forgetTabSchema(tabId: string): void {
  useSchemas.setState((s) => {
    const { [tabId]: _removed, ...rest } = s.byTab;
    return { byTab: rest };
  });
}

/** Validation results are cached per document version, so re-renders don't re-validate. */
const results = new WeakMap<CompiledSchema, WeakMap<JsonDocument, SchemaProblem[]>>();

export function schemaProblems(tabId: string, doc: JsonDocument): SchemaProblem[] {
  const schema = schemaFor(tabId).compiled;
  if (!schema) return [];
  let perDoc = results.get(schema);
  if (!perDoc) results.set(schema, (perDoc = new WeakMap()));
  let problems = perDoc.get(doc);
  if (!problems) perDoc.set(doc, (problems = schema.validate(doc)));
  return problems;
}
