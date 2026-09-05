import { beforeEach, expect, it } from "vitest";
import {
  createDefaultDraft,
  loadWorkspaceDrafts,
  saveWorkspaceDraft,
} from "./workspaceDraftStore";
beforeEach(() => localStorage.clear());
it("restores each full draft independently and isolates account owners", () => {
  const draft = createDefaultDraft("main_image");
  draft.config.sellingPoints = "主图要求";
  draft.config.moduleReferenceAssets = {
    packaging: [
      {
        id: "box",
        fileName: "box.png",
        imageUrl: "https://example.com/box.png",
        note: "保留盒子",
      },
    ],
  };
  draft.product = {
    id: "product",
    imageUrl: "https://example.com/photo.png",
    fileName: "photo.png",
    source: "upload",
    createdAt: "2026-09-04",
  };
  expect(saveWorkspaceDraft("account:A", "main_image", draft)).toBe(true);
  expect(loadWorkspaceDrafts("account:A").main_image).toMatchObject(draft);
  expect(
    loadWorkspaceDrafts("account:A").detail_page.config.sellingPoints,
  ).toBe("");
  expect(loadWorkspaceDrafts("account:B").main_image.product).toBeNull();
});
