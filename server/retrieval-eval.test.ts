import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateRetrieval, validateDataset } from "./retrieval-eval.js";

describe("retrieval evaluation", () => {
  it("meets the versioned recall@5 target", () => {
    const result = evaluateRetrieval();

    expect(result.queries).toBe(50);
    expect(result.recallAt5).toBeGreaterThanOrEqual(result.target);
    expect(result.top1Accuracy).toBeGreaterThanOrEqual(result.top1Target);
    expect(result.failures).toEqual([]);
  });

  it("rejects malformed or self-inconsistent datasets", () => {
    expect(() => validateDataset({ version: "1.0", documents: [], queries: [] })).toThrow(
      "at least 50 documents",
    );

    const directory = mkdtempSync(join(tmpdir(), "sourcebound-eval-"));
    const datasetPath = join(directory, "invalid.json");
    writeFileSync(
      datasetPath,
      JSON.stringify({
        version: "1.0",
        documents: Array.from({ length: 50 }, (_, index) => ({
          name: `doc-${index}.md`,
          content: "content",
        })),
        queries: Array.from({ length: 50 }, () => ({
          id: "duplicate",
          query: "content",
          expectedSource: "missing.md",
        })),
      }),
    );
    try {
      expect(() => evaluateRetrieval(datasetPath)).toThrow("Query ids must be unique");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
