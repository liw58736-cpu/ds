import type {
  GenerationConfig,
  GenerationResult,
  ProductInput,
} from "../domain/types";
import { formatRoute, selectGenerationRoute } from "../domain/generationRoutes";
import { buildGenerationPrompt } from "../domain/promptBuilder";

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
  const route = selectGenerationRoute(input.config);
  const prompt = buildGenerationPrompt(input.config);
  const label = escapeSvgText(`${module} / ${platform} / ${aspectRatio}`);
  const quality = escapeSvgText(`Quality: ${route.quality}`);
  const routeLabel = escapeSvgText(`Route: ${formatRoute(route)}`);
  const promptSummary = escapeSvgText(
    `Prompt: ${prompt.modules
      .map((modulePrompt) => modulePrompt.title)
      .join(" + ")} - ${prompt.modules[0]?.prompt ?? ""}`,
  );
  const fileName = escapeSvgText(input.product.fileName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="#fbfbf5"/>
  <rect x="72" y="72" width="1056" height="756" rx="28" fill="#ffffff" stroke="#111111" stroke-width="4"/>
  <rect x="112" y="118" width="168" height="42" rx="21" fill="#c1fbd4"/>
  <text x="136" y="147" fill="#111111" font-family="Arial, sans-serif" font-size="22" font-weight="700">AI Mock</text>
  <text x="112" y="250" fill="#111111" font-family="Arial, sans-serif" font-size="58" font-weight="700">Commerce Image Result</text>
  <text x="112" y="340" fill="#3f3f46" font-family="Arial, sans-serif" font-size="40">${label}</text>
  <text x="112" y="418" fill="#71717a" font-family="Arial, sans-serif" font-size="30">${fileName}</text>
  <text x="112" y="468" fill="#3f3f46" font-family="Arial, sans-serif" font-size="24">${quality}</text>
  <text x="112" y="510" fill="#52525b" font-family="Arial, sans-serif" font-size="22">${routeLabel}</text>
  <text x="112" y="552" fill="#52525b" font-family="Arial, sans-serif" font-size="22">${promptSummary}</text>
  <rect x="112" y="520" width="420" height="210" rx="24" fill="#d4f9e0"/>
  <rect x="576" y="520" width="420" height="210" rx="24" fill="#f4f4ef" stroke="#e4e4e7"/>
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
