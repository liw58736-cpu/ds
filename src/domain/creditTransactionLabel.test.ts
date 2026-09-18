import { describe, expect, it } from "vitest";
import { defaultConfig } from "./defaults";
import { getGenerationCreditLabel } from "./creditTransactionLabel";

describe("getGenerationCreditLabel", () => {
  it.each([
    [{ ...defaultConfig, module: "main_image" as const }, "生成商品主图"],
    [{ ...defaultConfig, module: "detail_page" as const }, "生成详情页图片"],
    [{ ...defaultConfig, module: "lifestyle" as const }, "生成灵感创作图片"],
    [
      {
        ...defaultConfig,
        module: "white_background" as const,
        whiteBackgroundMode: "outfit_change" as const,
      },
      "生成换装图",
    ],
    [
      {
        ...defaultConfig,
        module: "white_background" as const,
        whiteBackgroundMode: "model_change" as const,
      },
      "生成换模特图",
    ],
  ])("returns a feature-specific ledger label", (config, expected) => {
    expect(getGenerationCreditLabel(config)).toBe(expected);
  });
});
