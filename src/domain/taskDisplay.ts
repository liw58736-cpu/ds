import { moduleLabels } from "./defaults";
import { buildGenerationPrompt } from "./promptBuilder";
import type { GenerationTask } from "./types";

export function describeTaskFunction(task: GenerationTask): string {
  const prompt = buildGenerationPrompt(task.config);
  const moduleNames = prompt.modules.map((module) => module.title);

  if (moduleNames.length === 0) {
    return moduleLabels[task.config.module];
  }

  return `${moduleLabels[task.config.module]} / ${moduleNames.join("、")}`;
}
