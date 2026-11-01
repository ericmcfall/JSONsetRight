// Phase 0 smoke test: proves Vitest runs and that every sample file is readable.
// Phase 1 replaces the JSON.parse checks with real engine tests (e.g. byte-identical round-trips).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const samplesDir = join(process.cwd(), "samples");
const sampleFiles = readdirSync(samplesDir);

describe("samples folder", () => {
  it("contains sample files", () => {
    expect(sampleFiles.length).toBeGreaterThan(0);
  });

  // Strict .json samples must already be valid for the built-in parser.
  for (const name of sampleFiles.filter((f) => f.endsWith(".json"))) {
    it(`${name} is valid strict JSON`, () => {
      const text = readFileSync(join(samplesDir, name), "utf8");
      expect(() => JSON.parse(text)).not.toThrow();
    });
  }
});
