import type {
  GenerationConfig,
  GenerationQuality,
  GenerationResolution,
} from "./types";

export type ProviderName =
  | "rightcode"
  | "gptsapi"
  | "krill"
  | "wuyinkeji"
  | "packyapi"
  | "coderelay";

export type ProviderTier = "standard" | "hd";

export interface ProviderRouteStep {
  provider: ProviderName;
  tier: ProviderTier;
}

export interface GenerationRoute {
  quality: GenerationQuality;
  fallbackStrategy: "sequential";
  providers: ProviderRouteStep[];
}

const temporarilyDisabledProviders = new Set<ProviderName>(["krill"]);

const templateRouteCandidates: ProviderRouteStep[] = [
  { provider: "rightcode", tier: "standard" },
  { provider: "wuyinkeji", tier: "standard" },
  { provider: "packyapi", tier: "standard" },
  { provider: "gptsapi", tier: "standard" },
];

const hdRouteCandidates: ProviderRouteStep[] = [
  { provider: "wuyinkeji", tier: "hd" },
  { provider: "rightcode", tier: "hd" },
  { provider: "gptsapi", tier: "standard" },
  { provider: "packyapi", tier: "hd" },
];

export function getQualityForResolution(
  resolution: GenerationResolution = "1K",
): GenerationQuality {
  if (resolution === "1K") {
    return "standard";
  }

  if (resolution === "4K") {
    return "4k";
  }

  return "2k";
}

export function selectGenerationRoute(config: GenerationConfig): GenerationRoute {
  const quality = getQualityForResolution(config.resolution);
  const providers =
    quality === "standard"
        ? templateRouteCandidates
        : hdRouteCandidates;

  return {
    quality,
    fallbackStrategy: "sequential",
    providers: withoutTemporarilyDisabledProviders(providers),
  };
}

function withoutTemporarilyDisabledProviders(
  providers: ProviderRouteStep[],
): ProviderRouteStep[] {
  return providers.filter(
    (step) => !temporarilyDisabledProviders.has(step.provider),
  );
}

export function formatRoute(route: GenerationRoute): string {
  return route.providers
    .map((step) =>
      step.tier === "hd" ? `${step.provider} hd` : step.provider,
    )
    .join(" -> ");
}
