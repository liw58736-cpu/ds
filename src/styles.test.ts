import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/styles.css", "utf8");
const workspaceStylesheet = readFileSync(
  "src/workspace-redesign.css",
  "utf8",
);

describe("stylesheet quality guard", () => {
  it("does not use thick one-sided accent borders on cards or hints", () => {
    const thickSideBorders = Array.from(
      stylesheet.matchAll(
        /border-(?:left|right)\s*:\s*(\d+(?:\.\d+)?)px\s+solid/gi,
      ),
    ).filter((match) => Number(match[1]) > 1);

    expect(thickSideBorders).toEqual([]);
  });

  it("keeps the mobile workspace preview inside the page flow", () => {
    expect(stylesheet).toMatch(
      /\.studio-split\s*{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(stylesheet).toMatch(/\.studio-preview\s*{\s*width:\s*100%;/);
  });

  it("keeps every mobile navigation destination in one scrollable row", () => {
    expect(workspaceStylesheet).toMatch(
      /@media\s*\(max-width:\s*800px\)[\s\S]*?\.topnav\s*{[^}]*display:\s*flex;[^}]*overflow:\s*auto;[^}]*flex-wrap:\s*nowrap;/s,
    );
  });

  it("keeps mobile module choices compact without breaking very narrow screens", () => {
    expect(stylesheet).toMatch(
      /\.module-card-grid\s*{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(stylesheet).toMatch(
      /\.detail-module-grid\s*{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(stylesheet).toMatch(
      /@media\s*\(max-width:\s*359px\)[\s\S]*?\.module-card-grid\s*{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });

  it("only visually recommends the explicitly recommended pricing card", () => {
    expect(stylesheet).toMatch(
      /\.credit-plan-card:not\(\.is-recommended\)\s*{\s*border-color:\s*var\(--hairline\);\s*background:\s*#ffffff;/,
    );
  });

  it("keeps the interface on solid colors", () => {
    expect(`${stylesheet}\n${workspaceStylesheet}`).not.toMatch(
      /(?:linear|radial|conic)-gradient\s*\(/i,
    );
  });

  it("centers wide pages and aligns both navigation rows to one layout edge", () => {
    expect(workspaceStylesheet).toMatch(
      /\.app-shell\s*{[^}]*width:\s*100%;[^}]*max-width:\s*none;[^}]*margin:\s*0 auto;/s,
    );
    expect(workspaceStylesheet).toMatch(
      /\.topbar,[\s\S]*?\.studio-navigation,[\s\S]*?\.workspace,[\s\S]*?\.site-footer\s*{[^}]*width:\s*min\(var\(--kroma-wide-layout\),\s*100%\);[^}]*margin-left:\s*auto;[^}]*margin-right:\s*auto;/,
    );
  });
});
