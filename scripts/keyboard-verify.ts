import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright-core";

const APP_URL = process.env.SOURCEBOUND_URL ?? "http://localhost:5173";
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 1440, height: 900 },
];
const require = createRequire(import.meta.url);
const runId = Date.now();

async function tabUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  direction: "forward" | "backward" = "forward",
) {
  const focusTrail: string[] = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.keyboard.press(direction === "forward" ? "Tab" : "Shift+Tab");
    focusTrail.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        return [
          element?.tagName,
          element?.getAttribute("aria-label"),
          element?.textContent?.trim().slice(0, 40),
        ].join(":");
      }),
    );
    if (await predicate()) return;
  }
  throw new Error(`Target control was not reachable. Focus trail: ${focusTrail.join(" -> ")}`);
}

async function verifyViewport(page: Page, width: number, filePath: string, keyword: string) {
  await page.setViewportSize({ width, height: width === 320 ? 800 : 900 });
  await page.goto(APP_URL);

  await tabUntil(page, async () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Import files"),
  );
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
  await page.getByRole("heading", { name: filePath.split("/").at(-1) }).waitFor();

  await page.keyboard.press("/");
  await page.waitForFunction(() => document.activeElement?.id === "library-search");
  await page.keyboard.type(keyword);
  await page.getByText(keyword, { exact: true }).waitFor();
  await tabUntil(page, async () =>
    page.evaluate(() => document.activeElement?.textContent?.includes(".md") === true),
  );
  await page.keyboard.press("Enter");

  const heading = page.getByRole("heading", { name: filePath.split("/").at(-1) });
  await heading.waitFor();
  await page.waitForFunction(
    (expectedName) =>
      document.activeElement?.tagName === "H2" &&
      document.activeElement.textContent?.trim() === expectedName,
    filePath.split("/").at(-1),
  );

  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const seriousViolations = await page.evaluate(async () => {
    const result = await window.axe.run();
    return result.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
  });
  if (seriousViolations.length) {
    throw new Error(`Accessibility violations at ${width}px: ${JSON.stringify(seriousViolations)}`);
  }

  return { width, keyboardWorkflow: "pass", seriousAxeViolations: 0 };
}

declare global {
  interface Window {
    axe: {
      run: () => Promise<{
        violations: Array<{ impact: string | null; id: string }>;
      }>;
    };
  }
}

const directory = mkdtempSync(join(tmpdir(), "sourcebound-keyboard-"));
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

try {
  const evidence = [];
  for (const viewport of VIEWPORTS) {
    const keyword = `keyboard${viewport.width}x${runId}`;
    const filename = `keyboard-${viewport.width}-${runId}.md`;
    const filePath = join(directory, filename);
    writeFileSync(filePath, `Sourcebound keyboard verification keyword: ${keyword}.`);
    const page = await browser.newPage();
    try {
      evidence.push(await verifyViewport(page, viewport.width, filePath, keyword));
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify({ appUrl: APP_URL, evidence }, null, 2));
} finally {
  await browser.close();
  rmSync(directory, { recursive: true, force: true });
}
