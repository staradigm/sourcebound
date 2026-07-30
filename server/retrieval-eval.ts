import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";

type Dataset = {
  version: string;
  documents: Array<{ name: string; content: string; tags?: string[] }>;
  queries: Array<{ id: string; query: string; expectedSource: string }>;
};

const DEFAULT_DATASET = fileURLToPath(
  new URL("../eval/retrieval-v1.json", import.meta.url),
);
const TARGET_RECALL_AT_5 = 0.9;
const TARGET_TOP_1_ACCURACY = 0.9;

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique.`);
  }
}

export function validateDataset(value: unknown): asserts value is Dataset {
  if (!value || typeof value !== "object") throw new Error("Dataset must be an object.");
  const dataset = value as Partial<Dataset>;
  if (dataset.version !== "1.0") throw new Error("Dataset version must be 1.0.");
  if (!Array.isArray(dataset.documents) || dataset.documents.length < 50) {
    throw new Error("Dataset must contain at least 50 documents.");
  }
  if (!Array.isArray(dataset.queries) || dataset.queries.length !== 50) {
    throw new Error("Dataset must contain exactly 50 queries.");
  }
  if (
    dataset.documents.some(
      (document) =>
        !document ||
        typeof document.name !== "string" ||
        !document.name.trim() ||
        typeof document.content !== "string" ||
        !document.content.trim() ||
        (document.tags !== undefined &&
          (!Array.isArray(document.tags) ||
            document.tags.some((tag) => typeof tag !== "string" || !tag.trim()))),
    )
  ) {
    throw new Error("Every document must have a name, content, and optional tags.");
  }
  if (
    dataset.queries.some(
      (query) =>
        !query ||
        typeof query.id !== "string" ||
        !query.id.trim() ||
        typeof query.query !== "string" ||
        !query.query.trim() ||
        typeof query.expectedSource !== "string" ||
        !query.expectedSource.trim(),
    )
  ) {
    throw new Error("Every query must have an id, query, and expected source.");
  }
  const documentNames = dataset.documents.map(({ name }) => name);
  assertUnique(documentNames, "Document names");
  assertUnique(dataset.queries.map(({ id }) => id), "Query ids");
  const knownDocuments = new Set(documentNames);
  if (dataset.queries.some(({ expectedSource }) => !knownDocuments.has(expectedSource))) {
    throw new Error("Every expected source must reference a dataset document.");
  }
}

export function evaluateRetrieval(datasetPath = DEFAULT_DATASET) {
  const dataset: unknown = JSON.parse(readFileSync(datasetPath, "utf8"));
  validateDataset(dataset);
  const store = createStore(":memory:");

  try {
    store.addMany(dataset.documents);
    const failures: Array<{ id: string; expected: string; returned: string[] }> = [];
    const top1Failures: Array<{ id: string; expected: string; returned?: string }> = [];
    for (const query of dataset.queries) {
      const returned = store.search(query.query).slice(0, 5).map(({ name }) => name);
      if (!returned.includes(query.expectedSource)) {
        failures.push({ id: query.id, expected: query.expectedSource, returned });
      }
      if (returned[0] !== query.expectedSource) {
        top1Failures.push({ id: query.id, expected: query.expectedSource, returned: returned[0] });
      }
    }
    const hits = dataset.queries.length - failures.length;
    const recallAt5 = hits / dataset.queries.length;
    const top1Accuracy = (dataset.queries.length - top1Failures.length) / dataset.queries.length;
    return {
      datasetVersion: dataset.version,
      queries: dataset.queries.length,
      hits,
      recallAt5: Number(recallAt5.toFixed(3)),
      target: TARGET_RECALL_AT_5,
      top1Accuracy: Number(top1Accuracy.toFixed(3)),
      top1Target: TARGET_TOP_1_ACCURACY,
      passed: recallAt5 >= TARGET_RECALL_AT_5 && top1Accuracy >= TARGET_TOP_1_ACCURACY,
      failures,
      top1Failures,
    };
  } finally {
    store.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = evaluateRetrieval(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
