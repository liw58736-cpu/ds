import { listGenerationTasks } from "./generationApi";
import { listSavedMaterials } from "./materialImportApi";
import { getTaskResultAssets } from "../domain/resultAssets";

export interface MaterialLibraryAsset {
  id: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  source: "saved" | "generated";
  sourceLabel: string;
}

export async function listMaterialLibraryAssets(): Promise<MaterialLibraryAsset[]> {
  const [savedResult, generatedResult] = await Promise.allSettled([
    listSavedMaterials(100),
    listGenerationTasks({ limit: 100 }),
  ]);
  const assets: MaterialLibraryAsset[] = [];

  if (savedResult.status === "fulfilled") {
    assets.push(...savedResult.value.map((material) => ({
      id: `saved:${material.id}`,
      imageUrl: material.imageUrl,
      fileName: material.fileName,
      createdAt: material.createdAt,
      source: "saved" as const,
      sourceLabel: "保存素材",
    })));
  }

  if (generatedResult.status === "fulfilled") {
    for (const task of generatedResult.value) {
      if (task.status !== "completed") continue;
      getTaskResultAssets(task).forEach((asset, index) => {
        assets.push({
          id: `generated:${task.id}:${index}`,
          imageUrl: asset.url,
          fileName: asset.label || `生成图片 ${index + 1}`,
          createdAt: task.completedAt ?? task.createdAt,
          source: "generated",
          sourceLabel: "生成结果",
        });
      });
    }
  }

  if (savedResult.status === "rejected" && generatedResult.status === "rejected") {
    throw new Error("素材库暂时无法同步，请稍后重试。");
  }

  const uniqueByUrl = new Map<string, MaterialLibraryAsset>();
  for (const asset of assets.sort(
    (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
  )) {
    if (!uniqueByUrl.has(asset.imageUrl)) uniqueByUrl.set(asset.imageUrl, asset);
  }
  return Array.from(uniqueByUrl.values());
}
