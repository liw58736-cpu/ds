import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/styles.css", "utf8");
const workspaceStylesheet = readFileSync(
  "src/workspace-redesign.css",
  "utf8",
);
const hubThemeStylesheet = readFileSync("src/hub-theme.css", "utf8");

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
    expect(`${stylesheet}\n${workspaceStylesheet}\n${hubThemeStylesheet}`).not.toMatch(
      /(?:linear|radial|conic)-gradient\s*\(/i,
    );
  });

  it("applies a dark desktop sidebar and returns navigation to page flow on smaller screens", () => {
    expect(hubThemeStylesheet).toMatch(/--canvas:\s*#090b10;/);
    expect(hubThemeStylesheet).toMatch(
      /\.topbar\s*{[^}]*position:\s*fixed;[^}]*width:\s*var\(--hub-sidebar\);/s,
    );
    expect(hubThemeStylesheet).toMatch(
      /@media\s*\(max-width:\s*1040px\)[\s\S]*?\.topbar\s*{[^}]*position:\s*relative;/s,
    );
  });

  it("shows mobile app and studio navigation without horizontal clipping", () => {
    expect(hubThemeStylesheet).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?\.topnav\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s,
    );
    expect(hubThemeStylesheet).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?\.studio-navigation\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s,
    );
  });

  it("keeps every AI-tool secondary surface on the dark theme", () => {
    expect(hubThemeStylesheet).toMatch(
      /\.setting-group\s+\.outfit-change-target-card,[\s\S]*?background:\s*#10161e;/,
    );
    expect(hubThemeStylesheet).toMatch(
      /\.cleanup-page\s*>\s*\.page-heading\s*{[^}]*background:\s*#111a21;/s,
    );
    expect(hubThemeStylesheet).toMatch(
      /\.notice-dialog-content,[\s\S]*?\.notice-dialog\s*{[^}]*background:\s*#12161e;/s,
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

  it("uses a two-column link extractor with compact clickable thumbnails", () => {
    expect(workspaceStylesheet).toMatch(
      /\.material-extract-workbench\s*{[^}]*grid-template-columns:\s*minmax\(320px,\s*400px\)\s+minmax\(0,\s*1fr\);/,
    );
    expect(workspaceStylesheet).toMatch(
      /\.material-extract-workbench\s+\.material-import-grid\s*{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(112px,\s*132px\)\);/,
    );
    expect(workspaceStylesheet).toMatch(
      /\.material-extract-workbench\s+\.material-extracted-thumbnail\s*{[^}]*cursor:\s*zoom-in;/,
    );
  });
});
