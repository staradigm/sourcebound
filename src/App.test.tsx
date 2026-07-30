// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const documentSummary = {
  id: 1,
  name: "research.md",
  size: 42,
  createdAt: "2026-07-30 12:00:00",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("Sourcebound workspace", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/documents" && init?.method === "POST") {
          return jsonResponse({
            ...documentSummary,
            content: "Trustworthy source text.",
          }, 201);
        }
        if (url === "/api/documents") return jsonResponse([documentSummary]);
        if (url === "/api/documents/1") {
          return jsonResponse({ ...documentSummary, content: "Trustworthy source text." });
        }
        if (url.startsWith("/api/search")) {
          return jsonResponse([
            {
              ...documentSummary,
              excerpt: "A trustworthy passage.",
              highlights: [[2, 13]],
            },
          ]);
        }
        return jsonResponse({ error: "Unexpected request" }, 500);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("supports the search-open workflow without serious accessibility violations", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByText("research.md");
    const file = new File(["Trustworthy source text."], "research.md", {
      type: "text/markdown",
    });
    await user.upload(screen.getByLabelText("Choose a Markdown or text file"), file);
    await screen.findByText("Trustworthy source text.");
    await user.type(screen.getByLabelText("Search documents"), "trustworthy");
    await screen.findByText("trustworthy");
    const resultButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("research.md"));
    expect(resultButton).toBeDefined();
    await user.click(resultButton!);
    await screen.findByText("Trustworthy source text.");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "research.md" }));

    const results = await axe.run(container, { resultTypes: ["violations"] });
    expect(
      results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    ).toEqual([]);
  });

  it("exposes the primary controls in a predictable keyboard order", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("research.md");

    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Sourcebound home"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Import document"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Search documents"));

    fireEvent.keyDown(screen.getByLabelText("Search documents"), { key: "Escape" });
    await waitFor(() => {
      expect((screen.getByLabelText("Search documents") as HTMLInputElement).value).toBe("");
    });
  });
});
