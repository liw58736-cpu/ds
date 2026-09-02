import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/styles.css", "utf8");

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

  it("shows every mobile navigation destination in a compact grid", () => {
    expect(stylesheet).toMatch(
      /\.topnav\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s,
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
    expect(stylesheet).not.toMatch(/(?:linear|radial|conic)-gradient\s*\(/i);
  });
});
