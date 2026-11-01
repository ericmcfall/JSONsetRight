// Every file in samples/ must open and save back to exactly the same text.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, toFileText } from "./document";

const samplesDir = join(process.cwd(), "samples");
const sampleFiles = readdirSync(samplesDir);

describe("samples folder", () => {
  it("contains sample files", () => {
    expect(sampleFiles.length).toBeGreaterThan(0);
  });

  for (const name of sampleFiles) {
    it(`${name} round-trips byte-for-byte`, () => {
      const text = readFileSync(join(samplesDir, name), "utf8");
      expect(toFileText(parseDocument(text))).toBe(text);
    });
  }

  it("detects the JSONC sample's dialect", () => {
    const doc = parseDocument(readFileSync(join(samplesDir, "vscode-settings.jsonc"), "utf8"));
    expect(doc.dialect).toBe("jsonc");
    expect(doc.hasComments).toBe(true);
    expect(doc.hasTrailingCommas).toBe(true);
  });

  it("detects tab indentation", () => {
    const doc = parseDocument(readFileSync(join(samplesDir, "tabs-and-escapes.json"), "utf8"));
    expect(doc.format.indent).toBe("\t");
    expect(doc.dialect).toBe("json");
  });
});
