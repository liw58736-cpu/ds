import { GenerationProviderError } from "../providers/generationProvider";
import { MockGenerationProvider } from "../providers/generationProvider";
import type { GenerationTaskCreateRequest } from "./apiContracts";
import type { GenerationRouteMode } from "./apiContracts";

export interface GenerationTaskResponse {
  taskId: string;
  status: "completed" | "failed";
  resultUrls: string[];
  creditCost: number;
  routeMode: GenerationRouteMode;
  channelUsed?: string;
  errorCode?: string;
  errorMessage?: string;
}

const mockProvider = new MockGenerationProvider({ delayMs: 20 });

export async function submitGenerationTask(
  request: GenerationTaskCreateRequest,
): Promise<GenerationTaskResponse> {
  try {
    const result = await mockProvider.generate({
      product: request.body.product,
      config: request.body.config,
    });

    return {
      taskId: createMockTaskId(),
      status: "completed",
      resultUrls: result.resultUrls,
      creditCost: request.body.billing.estimatedCreditCost,
      routeMode: request.body.routeMode,
    };
  } catch (error) {
    if (error instanceof GenerationProviderError) {
      return {
        taskId: createMockTaskId(),
        status: "failed",
        resultUrls: [],
        creditCost: 0,
        routeMode: request.body.routeMode,
        errorCode: error.code,
        errorMessage: error.message,
      };
    }

    return {
      taskId: createMockTaskId(),
      status: "failed",
      resultUrls: [],
      creditCost: 0,
      routeMode: request.body.routeMode,
      errorCode: "unknown_generation_error",
      errorMessage: "生成失败，请重试。",
    };
  }
}

function createMockTaskId(): string {
  return `mock-generation-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
