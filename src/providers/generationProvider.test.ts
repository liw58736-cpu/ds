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
    expect(result.resultUrls[0]).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
    expect(decodeURIComponent(result.resultUrls[0])).toContain("detail_page");
  });

  it("escapes dynamic text before writing it into SVG text nodes", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    const result = await provider.generate({
      ...input,
      product: {
        ...input.product,
        fileName: "A & <B>.png",
      },
    });
    const svg = decodeURIComponent(result.resultUrls[0]);

    expect(svg).toContain("A &amp; &lt;B&gt;.png");
    expect(svg).not.toContain("A & <B>.png");
  });

  it("escapes malicious SVG-like filenames before writing them into the SVG", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    const result = await provider.generate({
      ...input,
      product: {
        ...input.product,
        fileName: "</text><script>alert(1)</script>",
      },
    });
    const svg = decodeURIComponent(result.resultUrls[0]);

    expect(svg).toContain(
      "&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(svg).not.toContain("</text><script>alert(1)</script>");
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

  it("rejects when selling points are the standalone fail sentinel", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    await expect(
      provider.generate({
        ...input,
        config: {
          ...input.config,
          sellingPoints: "fail",
        },
      }),
    ).rejects.toMatchObject({
      code: "mock_generation_failed",
      message: "模拟生成失败，请重试。",
    });
  });

  it("rejects when selling points contain the explicit mock-fail token", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    await expect(
      provider.generate({
        ...input,
        config: {
          ...input.config,
          sellingPoints: "Trigger [mock-fail] state for retry QA",
        },
      }),
    ).rejects.toMatchObject({
      code: "mock_generation_failed",
      message: "模拟生成失败，请重试。",
    });
  });

  it("does not reject ordinary product copy that contains fail as part of a word", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });

    const result = await provider.generate({
      ...input,
      config: {
        ...input.config,
        sellingPoints: "fail-safe closure with failure-resistant packaging",
      },
    });

    expect(result.creditCost).toBe(1);
  });
});
