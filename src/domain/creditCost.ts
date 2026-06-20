import type {
  DetailPageModuleId,
  GenerationConfig,
  GenerationResolution,
} from "./types";

export const resolutionCreditCosts: Record<GenerationResolution, number> = {
  "1K": 1,
  "2K": 2,
  "4K": 4,
};

export const brandVersionExtraCredits = 2;

export function getResolutionCreditCost(
  resolution: GenerationResolution = "1K",
): number {
  return resolutionCreditCosts[resolution];
}

export function getGenerationImageCount(config: GenerationConfig): number {
  if (config.module === "main_image") {
    return Math.max(1, config.selectedMainModules?.length ?? 0);
  }

  if (config.module === "detail_page") {
    const selectedCount = Object.values(
      config.detailModuleCounts ?? ({} as Partial<Record<DetailPageModuleId, number>>),
    ).reduce((sum, count) => sum + normalizeModuleCount(count), 0);

    return Math.max(1, selectedCount);
  }

  return 1;
}

export function estimateGenerationCredits(config: GenerationConfig): number {
  const resolutionCost = getResolutionCreditCost(config.resolution ?? "1K");
  const imageCost = getGenerationImageCount(config) * resolutionCost;
  const versionExtra =
    config.generationVersion === "brand" ? brandVersionExtraCredits : 0;

  return imageCost + versionExtra;
}

function normalizeModuleCount(count: number | undefined): number {
  if (!count || count < 0) {
    return 0;
  }

  return Math.floor(count);
}
