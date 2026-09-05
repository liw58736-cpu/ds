import { describe, expect, it } from "vitest";
import { defaultConfig } from "../domain/defaults";
import type { MainImageModuleId, DetailPageModuleId } from "../domain/types";
import { buildGenerationTaskRequest } from "./apiContracts";
import { buildKromaGenerateRequest } from "./kromaGenerationAdapter";

const main: MainImageModuleId[] = ["hero_kv", "overall_show", "detail_closeup", "use_scene", "color_set", "function_compare", "packaging", "trust"];
const detail: DetailPageModuleId[] = ["main_display", "brand_intro", "style_selling", "fabric_craft", "cutting", "color_size", "multi_color", "promotion", "specs", "care", "service", "faq", "buyer_show", "outfit_recommend", "scene_outfit", "blogger_outfit", "flat_lay", "hanger", "chapter"];
const product = { id: "coverage", imageUrl: "https://fixture.invalid/product.png", fileName: "product.png", source: "upload" as const, createdAt: "2026-09-05T00:00:00Z" };

describe("all module input contracts", () => {
  for (const id of [...main, ...detail]) {
    it(`${id}: sends Image 1, only its own Image 2, notes and visible text at all resolutions`, () => {
      for (const [resolution, quality, cost] of [["1K", "standard", 1], ["2K", "2k", 2], ["4K", "4k", 4]] as const) {
        const isMain = main.includes(id as MainImageModuleId);
        const request = buildGenerationTaskRequest({ product, groupId: "coverage-group", config: {
          ...defaultConfig, module: isMain ? "main_image" : "detail_page", resolution,
          selectedMainModules: isMain ? [id as MainImageModuleId] : [],
          detailModuleCounts: isMain ? {} : { [id]: 1 },
          moduleReferenceAssets: {
            [id]: [{ id: "selected", imageUrl: `https://fixture.invalid/${id}.png`, fileName: "selected.png", note: "保留同一商品，不增加其他颜色", noteMode: "instruction", visibleText: "仅售 XL" }],
            unrelated: [{ id: "not-selected", imageUrl: "https://fixture.invalid/unrelated.png", fileName: "not-selected.png", note: "不应发送的备注" }],
          },
        }});
        const payload = buildKromaGenerateRequest(request);
        expect(payload.image_url).toBe(product.imageUrl);
        expect(payload.template_image_base64s).toEqual([`https://fixture.invalid/${id}.png`]);
        expect(payload.prompt).toContain("保留同一商品，不增加其他颜色");
        expect(payload.prompt).toContain("仅售 XL");
        expect(payload.prompt).not.toContain("不应发送的备注");
        expect(payload.quality).toBe(quality);
        expect(request.body.billing.estimatedCreditCost).toBe(cost);
      }
    });
  }
});
