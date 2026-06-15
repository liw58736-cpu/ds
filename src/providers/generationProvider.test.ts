import {
  GenerationProviderError,
  MockGenerationProvider,
} from "./generationProvider";
import type { GenerateInput } from "./generationProvider";

const input: GenerateInput = {
  product: {
    id: "product-1",
    imageUrl: "/sample/product.png",
    fileName: "product.png",
    createdAt: "2026-06-15T00:00:00.000Z",
    source: "upload",
  },
  config: {
    module: "detail_page",
    platform: "shopify",
    aspectRatio: "long_page",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "Lightweight, reusable packaging",
    specifications: "30cm x 12cm x 8cm",
  },
};

describe("MockGenerationProvider", () => {
  it("returns a one-credit SVG result that includes the selected module", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    const result = await provider.generate(input);

    expect(result.creditCost).toBe(1);
    expect(result.resultUrls).toHaveLength(1);
    expect(result.resultUrls[0]).toContain("data:image/svg+xml,");
    expect(decodeURIComponent(result.resultUrls[0])).toContain("detail_page");
  });

  it("rejects controlled failures with provider code and Chinese message", async () => {
    const provider = new MockGenerationProvider({
      delayMs: 0,
      forceFailure: true,
    });

    await expect(provider.generate(input)).rejects.toMatchObject({
      name: "GenerationProviderError",
      code: "mock_generation_failed",
      message: "模拟生成失败，请重试。",
    });
    await expect(provider.generate(input)).rejects.toBeInstanceOf(
      GenerationProviderError,
    );
  });
});
