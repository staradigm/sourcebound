import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { createStore, type Store } from "./store.js";

const NOTE_COUNT = 1_000;
const SEARCH_COUNT = 100;
const TARGET_P95_MS = 500;

export function runBenchmark() {
  const directory = mkdtempSync(join(tmpdir(), "sourcebound-benchmark-"));
  const databasePath = join(directory, "benchmark.db");
  let store: Store | undefined = createStore(databasePath);
  const topics = ["retrieval", "citations", "privacy", "indexing", "research"];

  try {
    for (let index = 0; index < NOTE_COUNT; index += 1) {
      const topic = topics[index % topics.length];
      store.add(
        `note-${index}.md`,
        `Research note ${index}. The primary topic is ${topic}. ` +
          `Sourcebound keeps this representative document on the local machine. `.repeat(8),
      );
    }

    store.close();
    store = undefined;
    store = createStore(databasePath);
    const durations: number[] = [];
    for (let index = 0; index < SEARCH_COUNT; index += 1) {
      const started = performance.now();
      store.search(topics[index % topics.length]);
      durations.push(performance.now() - started);
    }

    durations.sort((left, right) => left - right);
    const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1];
    return {
      documents: NOTE_COUNT,
      searches: SEARCH_COUNT,
      p95Ms: Number(p95Ms.toFixed(3)),
      targetMs: TARGET_P95_MS,
      passed: p95Ms < TARGET_P95_MS,
      database: "temporary file, closed and reopened before measurement",
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
    };
  } finally {
    try {
      store?.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBenchmark();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
