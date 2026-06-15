import type {
  GenerationConfig,
  GenerationResult,
  ProductInput,
} from "../domain/types";

export interface GenerateInput {
  product: ProductInput;
  config: GenerationConfig;
}

export interface GenerationProvider {
  generate(input: GenerateInput): Promise<GenerationResult>;
}

export class GenerationProviderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GenerationProviderError";
    this.code = code;
  }
}

interface MockGenerationProviderOptions {
  delayMs?: number;
  forceFailure?: boolean;
}

export class MockGenerationProvider implements GenerationProvider {
  private readonly delayMs: number;
  private readonly forceFailure: boolean;

  constructor(options: MockGenerationProviderOptions = {}) {
    this.delayMs = options.delayMs ?? 700;
    this.forceFailure = options.forceFailure ?? false;
  }

  async generate(input: GenerateInput): Promise<GenerationResult> {
    await wait(this.delayMs);

    if (
      this.forceFailure ||
      // Deterministic mock failure trigger for UI retry-flow testing: standalone "fail" or "[mock-fail]".
      hasMockFailureTrigger(input.config.sellingPoints)
    ) {
      throw new GenerationProviderError(
        "mock_generation_failed",
        "模拟生成失败，请重试。",
      );
    }

    return {
      resultUrls: [createMockResultUrl(input)],
      creditCost: 1,
    };
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

function createMockResultUrl(input: GenerateInput): string {
  const { module, platform, aspectRatio } = input.config;
  const label = escapeSvgText(`${module} / ${platform} / ${aspectRatio}`);
  const fileName = escapeSvgText(input.product.fileName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="#f7f8f5"/>
  <rect x="72" y="72" width="1056" height="756" rx="28" fill="#ffffff" stroke="#1f2937" stroke-width="4"/>
  <text x="112" y="170" fill="#111827" font-family="Arial, sans-serif" font-size="54" font-weight="700">Mock AI Result</text>
  <text x="112" y="260" fill="#374151" font-family="Arial, sans-serif" font-size="40">${label}</text>
  <text x="112" y="338" fill="#6b7280" font-family="Arial, sans-serif" font-size="30">${fileName}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function hasMockFailureTrigger(sellingPoints: string): boolean {
  return /(^|[\s,;:()[\]{}])(?:fail|\[mock-fail\])(?=$|[\s,;:()[\]{}])/i.test(
    sellingPoints,
  );
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
