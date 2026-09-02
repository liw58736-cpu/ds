import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  brandVersionExtraCredits,
  estimateGenerationCredits,
  getGenerationImageCount,
  getResolutionCreditCost,
} from "../domain/creditCost";
import { moduleLabels } from "../domain/defaults";
import type {
  AspectRatio,
  DetailPageModuleId,
  GenerationConfig,
  GenerationModule,
  GenerationResolution,
  GenerationVersion,
  InspirationBackground,
  InspirationComposition,
  InspirationModel,
  InspirationPose,
  InspirationPurpose,
  InspirationProductHandling,
  InspirationSettings,
  MainImageModuleId,
  ModuleReferenceAsset,
  WhiteBackgroundMode,
} from "../domain/types";
import { NoticeDialog } from "./NoticeDialog";

type StudioModule = Extract<
  GenerationModule,
  "main_image" | "white_background" | "detail_page" | "lifestyle"
>;

interface ParameterPanelProps {
  activeModule: StudioModule;
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
  onGenerate: () => void;
  onBuyCredits?: () => void;
  hasProduct: boolean;
  isGenerateDisabled: boolean;
  runningTaskCount: number;
  isOutOfCredits?: boolean;
}

const pageMeta = {
  main_image: {
    eyebrow: "Main Image Settings",
    title: "商品主图生成",
    description: "选择主图结构、尺寸和促销信息，生成适合首图转化的素材。",
  },
  white_background: {
    eyebrow: "AI Tools",
    title: "AI工具",
    description: "选择常用 AI 商品图工具，上传商品图后快速生成对应素材。",
  },
  detail_page: {
    eyebrow: "Detail Page Settings",
    title: "服装详情页生成",
    description: "按服装详情页模块生成组图，适合搭建完整商品详情内容。",
  },
  lifestyle: {
    eyebrow: "INSPIRATION CREATOR",
    title: "灵感创作",
    description: "用商品图搭配灵感参考，调整背景、姿态、模特和构图，生成新的电商视觉。",
  },
} as const satisfies Record<
  StudioModule,
  { eyebrow: string; title: string; description: string }
>;

const moduleDisplayLabels: Record<StudioModule, string> = {
  main_image: "商品主图",
  white_background: "AI工具",
  detail_page: "详情页",
  lifestyle: "灵感创作",
};

const aspectRatioOptions: Array<{ value: AspectRatio; label: string }> = [
  { value: "original", label: "原图尺寸" },
  { value: "1:1", label: "1:1 方图" },
  { value: "4:5", label: "4:5 竖图" },
  { value: "3:4", label: "3:4 竖图" },
  { value: "9:16", label: "9:16 竖图" },
  { value: "16:9", label: "16:9 横图" },
  { value: "long_page", label: "详情长图" },
];

const outputLanguages = [
  "中文",
  "English",
  "日语",
  "韩语",
  "法语",
  "德语",
  "西班牙语",
  "意大利语",
  "葡萄牙语",
  "俄语",
  "阿拉伯语",
  "泰语",
  "越南语",
  "印尼语",
];
const resolutionOptions: GenerationResolution[] = ["1K", "2K", "4K"];
const versionOptions: Array<{
  value: GenerationVersion;
  name: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: "standard", name: "标准版", description: "快速出图，适合批量 SKU" },
  {
    value: "brand",
    name: "品牌版",
    description: "更重质感、光影和转化表达",
    recommended: true,
  },
];

const maxDetailModuleCount = 9;
const maxModuleReferenceAssets = 3;

function hasModuleReferenceImage(asset: ModuleReferenceAsset): boolean {
  return asset.imageUrl.trim().length > 0;
}

function hasModuleReferenceNote(asset: ModuleReferenceAsset): boolean {
  return (asset.note?.trim() ?? "").length > 0;
}

function createNoteOnlyReferenceAsset(note: string): ModuleReferenceAsset {
  return {
    id: `module-ref-note-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    fileName: "素材备注",
    imageUrl: "",
    note,
  };
}

function formatReferenceSummary(assets: ModuleReferenceAsset[]): string | null {
  const imageCount = assets.filter(hasModuleReferenceImage).length;
  const noteCount = assets.filter(
    (asset) => !hasModuleReferenceImage(asset) && hasModuleReferenceNote(asset),
  ).length;

  if (imageCount > 0 && noteCount > 0) {
    return `已加 ${imageCount} 张素材 / ${noteCount} 条备注`;
  }

  if (imageCount > 0) {
    return `已加 ${imageCount} 张素材`;
  }

  if (noteCount > 0) {
    return `已加 ${noteCount} 条备注`;
  }

  return null;
}

function isMainImageModuleId(moduleId: string): moduleId is MainImageModuleId {
  return mainImageModules.some((module) => module.id === moduleId);
}

function isDetailPageModuleId(moduleId: string): moduleId is DetailPageModuleId {
  return detailContentModules.some((module) => module.id === moduleId);
}

const mainImageModules: Array<{
  id: MainImageModuleId;
  title: string;
  description: string;
}> = [
  { id: "hero_kv", title: "首屏 KV", description: "建立第一眼识别" },
  { id: "overall_show", title: "整体展示", description: "完整形态与高级氛围" },
  { id: "detail_closeup", title: "细节特写", description: "放大材质与工艺" },
  { id: "use_scene", title: "使用场景", description: "呈现真实使用状态" },
  { id: "color_set", title: "多色套装", description: "展示多 SKU 与组合美感" },
  { id: "function_compare", title: "功能对比", description: "参数、功效与差异说明" },
  { id: "packaging", title: "包装展示", description: "礼盒、配件与开箱细节" },
  { id: "trust", title: "权益保障", description: "售后、质保与信任背书" },
];

const detailContentModules: Array<{
  id: DetailPageModuleId;
  title: string;
  description: string;
}> = [
  { id: "main_display", title: "主图展示", description: "首屏 KV：建立第一眼识别" },
  { id: "brand_intro", title: "品牌介绍", description: "编辑式封面 + 品牌定位" },
  { id: "style_selling", title: "款式卖点", description: "同造型多角度" },
  { id: "fabric_craft", title: "面料工艺", description: "穿着主图 + 工艺特写" },
  { id: "cutting", title: "版型剪裁", description: "动作展现廓形与垂坠" },
  { id: "color_size", title: "颜色尺码", description: "穿着主体 + 色卡 / 尺码" },
  { id: "multi_color", title: "多色组合", description: "同款多色并排对比" },
  { id: "promotion", title: "价格优惠", description: "克制促销卡" },
  { id: "specs", title: "规格参数", description: "穿着主体 + 引线规格卡" },
  { id: "care", title: "洗护说明", description: "穿着主体 + 养护图标条" },
  { id: "service", title: "售后保障", description: "三列等分保障卡" },
  { id: "faq", title: "常见问题", description: "问答卡 + 极细分隔线" },
  { id: "buyer_show", title: "买家秀", description: "伪 UGC 真实生活感" },
  { id: "outfit_recommend", title: "搭配推荐", description: "同模特三套搭配并排" },
  { id: "scene_outfit", title: "场景穿搭", description: "场景情境化穿着" },
  { id: "blogger_outfit", title: "博主穿搭", description: "OOTD 博主真实穿搭氛围" },
  { id: "flat_lay", title: "平铺图", description: "主商品 + 配饰自然俯拍" },
  { id: "hanger", title: "挂架展示", description: "服装店式真实陈列" },
  { id: "chapter", title: "章节过渡卡", description: "画册呼吸用纯文字过渡" },
];

const whiteBackgroundModes: Array<{
  value: WhiteBackgroundMode;
  label: string;
}> = [
  { value: "white_background", label: "白底图" },
  { value: "ghost_model", label: "幽灵模特" },
  { value: "ai_background", label: "AI背景" },
  { value: "retouch", label: "精修" },
  { value: "outfit_change", label: "换装" },
  { value: "product_showcase", label: "产品展示" },
];

const defaultInspirationSettings: InspirationSettings = {
  background: "lifestyle",
  pose: "natural",
  model: "none",
  composition: "hero",
  purpose: "product_listing",
  productHandling: "preserve",
};

const inspirationControls: Array<{
  key: keyof InspirationSettings;
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    key: "background",
    label: "背景",
    options: [
      { value: "original", label: "保留原场景" },
      { value: "studio", label: "高级棚拍" },
      { value: "lifestyle", label: "生活方式" },
      { value: "minimal", label: "极简留白" },
      { value: "seasonal", label: "节日氛围" },
    ],
  },
  {
    key: "pose",
    label: "姿态",
    options: [
      { value: "natural", label: "自然状态" },
      { value: "static", label: "稳定展示" },
      { value: "dynamic", label: "动态动作" },
      { value: "closeup", label: "局部近景" },
    ],
  },
  {
    key: "model",
    label: "模特",
    options: [
      { value: "none", label: "不添加模特" },
      { value: "female", label: "女性模特" },
      { value: "male", label: "男性模特" },
      { value: "diverse", label: "多元模特" },
    ],
  },
  {
    key: "composition",
    label: "构图",
    options: [
      { value: "hero", label: "主视觉" },
      { value: "editorial", label: "杂志感" },
      { value: "split", label: "多画面" },
      { value: "ugc", label: "真实分享" },
    ],
  },
  {
    key: "productHandling",
    label: "商品处理",
    options: [
      { value: "preserve", label: "原样保留" },
      { value: "feature", label: "突出商品" },
      { value: "wear", label: "模特穿戴" },
      { value: "in_use", label: "场景使用" },
    ],
  },
  {
    key: "purpose",
    label: "用途",
    options: [
      { value: "product_listing", label: "商品上架" },
      { value: "social_post", label: "社媒笔记" },
      { value: "ad_creative", label: "广告素材" },
      { value: "brand_story", label: "品牌内容" },
    ],
  },
];

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Reference image could not be read."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Reference image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function ParameterPanel({
  activeModule,
  config,
  onChange,
  onGenerate,
  onBuyCredits,
  hasProduct,
  isGenerateDisabled,
  runningTaskCount,
  isOutOfCredits = false,
}: ParameterPanelProps) {
  const [outputLanguage, setOutputLanguage] = useState(
    config.outputLanguage ?? outputLanguages[0],
  );
  const [editingReferenceModule, setEditingReferenceModule] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [draftReferenceAssets, setDraftReferenceAssets] = useState<
    ModuleReferenceAsset[]
  >([]);
  const [draftReferenceNote, setDraftReferenceNote] = useState("");
  const [showProductRequiredNotice, setShowProductRequiredNotice] =
    useState(false);
  const [
    showOutfitChangeRequiredNotice,
    setShowOutfitChangeRequiredNotice,
  ] = useState(false);
  const resolution = config.resolution ?? "1K";
  const generationVersion = config.generationVersion ?? "brand";
  const selectedMainModules = config.selectedMainModules ?? [];
  const detailCounts = config.detailModuleCounts ?? {};
  const moduleReferenceAssets = config.moduleReferenceAssets ?? {};
  const inspirationReferenceAssets = moduleReferenceAssets.inspiration ?? [];
  const inspirationReferenceImage = inspirationReferenceAssets.find(
    hasModuleReferenceImage,
  );
  const inspirationNote = inspirationReferenceAssets
    .map((asset) => asset.note?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
  const inspirationSettings = {
    ...defaultInspirationSettings,
    ...(config.inspirationSettings ?? {}),
  };
  const outfitChangeReferenceAssets = moduleReferenceAssets.outfit_change ?? [];
  const outfitChangeTargetAsset =
    outfitChangeReferenceAssets.find(hasModuleReferenceImage) ?? null;
  const draftImageReferenceAssets = draftReferenceAssets.filter(
    hasModuleReferenceImage,
  );
  const whiteBackgroundMode = config.whiteBackgroundMode ?? "white_background";
  const meta = pageMeta[activeModule];
  const normalizedConfig = { ...config, resolution, generationVersion };
  const selectedDetailCount = useMemo(
    () =>
      Object.values(detailCounts).reduce(
        (sum, count) => sum + Math.max(0, Math.floor(count ?? 0)),
        0,
      ),
    [detailCounts],
  );
  const estimatedCredits = estimateGenerationCredits(normalizedConfig);
  const estimatedImageCount = getGenerationImageCount(normalizedConfig);
  const resolutionCreditCost = getResolutionCreditCost(resolution);
  const activeAiToolLabel =
    whiteBackgroundModes.find((mode) => mode.value === whiteBackgroundMode)
      ?.label ?? "AI工具";

  const updateConfig = <Key extends keyof GenerationConfig>(
    key: Key,
    value: GenerationConfig[Key],
  ) => {
    onChange({ ...config, [key]: value });
  };

  useEffect(() => {
    if (hasProduct) {
      setShowProductRequiredNotice(false);
    }
  }, [hasProduct]);

  useEffect(() => {
    if (whiteBackgroundMode !== "outfit_change" || outfitChangeTargetAsset) {
      setShowOutfitChangeRequiredNotice(false);
    }
  }, [whiteBackgroundMode, outfitChangeTargetAsset]);

  const requireProductBeforeModuleSelection = () => {
    if (hasProduct) {
      return false;
    }

    setShowProductRequiredNotice(true);
    return true;
  };

  const toggleMainModule = (moduleId: MainImageModuleId) => {
    if (
      !selectedMainModules.includes(moduleId) &&
      requireProductBeforeModuleSelection()
    ) {
      return;
    }

    const nextModules = selectedMainModules.includes(moduleId)
      ? selectedMainModules.filter((currentModule) => currentModule !== moduleId)
      : [...selectedMainModules, moduleId];

    onChange({ ...config, selectedMainModules: nextModules });
  };

  const setDetailModuleCount = (
    moduleId: DetailPageModuleId,
    nextCount: number,
  ) => {
    if (nextCount > 0 && requireProductBeforeModuleSelection()) {
      return;
    }

    const normalizedCount = Math.max(
      0,
      Math.min(maxDetailModuleCount, Math.floor(nextCount)),
    );
    const nextDetailCounts = { ...detailCounts };

    if (normalizedCount === 0) {
      delete nextDetailCounts[moduleId];
    } else {
      nextDetailCounts[moduleId] = normalizedCount;
    }

    onChange({ ...config, detailModuleCounts: nextDetailCounts });
  };

  const addDetailModule = (moduleId: DetailPageModuleId) => {
    setDetailModuleCount(moduleId, (detailCounts[moduleId] ?? 0) + 1);
  };

  const selectWhiteBackgroundMode = (mode: WhiteBackgroundMode) => {
    if (
      mode !== whiteBackgroundMode &&
      requireProductBeforeModuleSelection()
    ) {
      return;
    }

    updateConfig("whiteBackgroundMode", mode);
  };

  const getReferenceAssets = (moduleId: string): ModuleReferenceAsset[] =>
    moduleReferenceAssets[moduleId] ?? [];

  const saveModuleReferenceAssets = (
    moduleId: string,
    assets: ModuleReferenceAsset[],
  ) => {
    const nextReferenceAssets = { ...moduleReferenceAssets };

    if (assets.length > 0) {
      nextReferenceAssets[moduleId] = assets;
    } else {
      delete nextReferenceAssets[moduleId];
    }

    onChange({
      ...config,
      moduleReferenceAssets:
        Object.keys(nextReferenceAssets).length > 0
          ? nextReferenceAssets
          : undefined,
    });
  };

  const updateInspirationSetting = <Key extends keyof InspirationSettings>(
    key: Key,
    value: InspirationSettings[Key],
  ) => {
    updateConfig("inspirationSettings", {
      ...inspirationSettings,
      [key]: value,
    });
  };

  const updateInspirationNote = (note: string) => {
    const trimmedNote = note.trim();
    const imageAssets = inspirationReferenceAssets.filter(hasModuleReferenceImage);
    const nextAssets = imageAssets.length > 0
      ? imageAssets.map((asset) => ({
          ...asset,
          ...(trimmedNote ? { note: trimmedNote } : { note: undefined }),
        }))
      : trimmedNote
        ? [createNoteOnlyReferenceAsset(trimmedNote)]
        : [];
    saveModuleReferenceAssets("inspiration", nextAssets);
  };

  const handleInspirationReferenceFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !hasProduct) {
      if (!hasProduct) {
        requireProductBeforeModuleSelection();
      }
      return;
    }

    const imageUrl = await readImageFile(file);
    const asset: ModuleReferenceAsset = {
      id: `inspiration-ref-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      fileName: file.name,
      imageUrl,
      ...(inspirationNote ? { note: inspirationNote } : {}),
    };
    saveModuleReferenceAssets("inspiration", [asset]);
  };

  const removeInspirationReference = () => {
    saveModuleReferenceAssets(
      "inspiration",
      inspirationNote ? [createNoteOnlyReferenceAsset(inspirationNote)] : [],
    );
  };

  const openReferenceEditor = (moduleId: string, title: string) => {
    if (requireProductBeforeModuleSelection()) {
      return;
    }

    const assets = getReferenceAssets(moduleId);
    const notes = assets
      .map((asset) => asset.note?.trim() ?? "")
      .filter((note) => note.length > 0);

    setEditingReferenceModule({ id: moduleId, title });
    setDraftReferenceAssets(assets);
    setDraftReferenceNote([...new Set(notes)].join("\n"));
  };

  const readReferenceFiles = async (
    files: FileList | null,
  ): Promise<ModuleReferenceAsset[]> => {
    if (!files) {
      return [];
    }

    const remainingSlots = Math.max(
      0,
      maxModuleReferenceAssets - draftImageReferenceAssets.length,
    );
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    return Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<ModuleReferenceAsset>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                id: `module-ref-${Date.now().toString(36)}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,
                fileName: file.name,
                imageUrl: String(reader.result ?? ""),
                ...(draftReferenceNote.trim()
                  ? { note: draftReferenceNote.trim() }
                  : {}),
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
  };

  const handleReferenceFilesChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const assets = await readReferenceFiles(event.target.files);

    setDraftReferenceAssets((currentAssets) =>
      [...currentAssets, ...assets].slice(0, maxModuleReferenceAssets),
    );
    event.target.value = "";
  };

  const handleOutfitChangeTargetFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const asset = await new Promise<ModuleReferenceAsset>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          id: `outfit-change-target-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          fileName: file.name,
          imageUrl: String(reader.result ?? ""),
          note: "Use this uploaded garment as the target clothing for outfit change.",
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    saveModuleReferenceAssets("outfit_change", [asset]);
    setShowOutfitChangeRequiredNotice(false);
    event.target.value = "";
  };

  const removeOutfitChangeTargetAsset = () => {
    saveModuleReferenceAssets("outfit_change", []);
    setShowOutfitChangeRequiredNotice(true);
  };

  const saveReferenceAssets = () => {
    if (!editingReferenceModule) {
      return;
    }

    const note = draftReferenceNote.trim();
    const nextReferenceAssets = { ...moduleReferenceAssets };
    const savedAssets = draftReferenceAssets
      .filter(hasModuleReferenceImage)
      .map((asset) => ({
        ...asset,
        ...(note ? { note } : {}),
      }));

    if (savedAssets.length === 0 && note) {
      savedAssets.push(createNoteOnlyReferenceAsset(note));
    }

    if (savedAssets.length > 0) {
      nextReferenceAssets[editingReferenceModule.id] = savedAssets;
    } else {
      delete nextReferenceAssets[editingReferenceModule.id];
    }

    const nextConfig: GenerationConfig = {
      ...config,
      moduleReferenceAssets:
        Object.keys(nextReferenceAssets).length > 0
          ? nextReferenceAssets
          : undefined,
    };

    if (
      savedAssets.length > 0 &&
      isMainImageModuleId(editingReferenceModule.id) &&
      !selectedMainModules.includes(editingReferenceModule.id)
    ) {
      nextConfig.selectedMainModules = [
        ...selectedMainModules,
        editingReferenceModule.id,
      ];
    }

    if (
      savedAssets.length > 0 &&
      isDetailPageModuleId(editingReferenceModule.id)
    ) {
      nextConfig.detailModuleCounts = {
        ...detailCounts,
        [editingReferenceModule.id]: Math.max(
          1,
          detailCounts[editingReferenceModule.id] ?? 0,
        ),
      };
    }

    onChange(nextConfig);
    setEditingReferenceModule(null);
    setDraftReferenceAssets([]);
    setDraftReferenceNote("");
  };

  const removeDraftReferenceAsset = (assetId: string) => {
    setDraftReferenceAssets((currentAssets) =>
      currentAssets.filter((asset) => asset.id !== assetId),
    );
  };

  const handleGenerateClick = () => {
    if (
      activeModule === "white_background" &&
      whiteBackgroundMode === "outfit_change" &&
      !outfitChangeTargetAsset
    ) {
      setShowOutfitChangeRequiredNotice(true);
      return;
    }

    onGenerate();
  };

  return (
    <>
    <aside className="panel parameter-panel" aria-labelledby="parameters-title">
      <div className="panel-heading">
        <p className="eyebrow">{meta.eyebrow}</p>
        <h2 id="parameters-title">{meta.title}</h2>
        <p>{meta.description}</p>
      </div>
      <label className="sr-only" htmlFor="module-label">
        模块
      </label>
      <input
        className="sr-only"
        id="module-label"
        value={moduleDisplayLabels[config.module as StudioModule] ?? moduleLabels[config.module]}
        readOnly
        aria-readonly="true"
      />

      {activeModule === "main_image" ? (
        <section className="setting-group" aria-labelledby="main-image-modules">
          <div className="setting-group-heading">
            <span id="main-image-modules">模块选择（多选）</span>
            <small>新用户可体验前 4 个模块。</small>
          </div>
          <p className="selection-count">已选 {selectedMainModules.length}</p>
          <div className="module-card-grid">
            {mainImageModules.map((module) => {
              const isActive = selectedMainModules.includes(module.id);
              const referenceSummary = formatReferenceSummary(
                getReferenceAssets(module.id),
              );

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={module.id}
                  className={`module-card-button${isActive ? " is-active" : ""}${
                    !hasProduct && !isActive ? " is-disabled" : ""
                  }`}
                  aria-label={`${module.title} ${module.description}`}
                  aria-pressed={isActive}
                  aria-disabled={!hasProduct && !isActive}
                  onClick={() => toggleMainModule(module.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    toggleMainModule(module.id);
                  }}
                >
                  <div className="module-card-topline">
                    <strong>{module.title}</strong>
                    <button
                      type="button"
                      className="module-reference-button"
                      aria-label="添加素材"
                      title={`为${module.title}添加素材`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openReferenceEditor(module.id, module.title);
                      }}
                    >
                      素材
                    </button>
                  </div>
                  <span>{module.description}</span>
                  {referenceSummary ? (
                    <em className="module-reference-count">
                      {referenceSummary}
                    </em>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeModule === "detail_page" ? (
        <section className="setting-group" aria-labelledby="detail-modules">
          <div className="setting-group-heading">
            <span id="detail-modules">服装详情内容模块</span>
            <small>点击未选模块会添加 1 张图，右上角可继续叠加数量。</small>
          </div>
          <p className="selection-count">已选 {selectedDetailCount}</p>
          <div className="detail-module-grid">
            {detailContentModules.map((module) => {
              const count = detailCounts[module.id] ?? 0;
              const isActive = count > 0;
              const referenceSummary = formatReferenceSummary(
                getReferenceAssets(module.id),
              );

              return (
                <div
                  key={module.id}
                  role="button"
                  tabIndex={0}
                  className={`detail-module-button${isActive ? " is-active" : ""}${
                    !hasProduct && !isActive ? " is-disabled" : ""
                  }`}
                  aria-pressed={isActive}
                  aria-disabled={!hasProduct && !isActive}
                  aria-label={`${module.title} ${module.description}`}
                  onClick={() => {
                    if (!isActive) {
                      addDetailModule(module.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    if (!isActive) {
                      addDetailModule(module.id);
                    }
                  }}
                >
                  <div className="module-card-topline">
                    <strong>{module.title}</strong>
                    <button
                      type="button"
                      className="module-reference-button"
                      aria-label="添加素材"
                      title={`为${module.title}添加素材`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openReferenceEditor(module.id, module.title);
                      }}
                    >
                      素材
                    </button>
                  </div>
                  <span>{module.description}</span>
                  <div
                    className="detail-module-stepper"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`${module.title} 减少 1 张`}
                      onClick={() => setDetailModuleCount(module.id, count - 1)}
                      disabled={count === 0}
                    >
                      -
                    </button>
                    <b>{count}</b>
                    <button
                      type="button"
                      aria-label={`${module.title} 增加 1 张`}
                      onClick={() => addDetailModule(module.id)}
                      disabled={count >= maxDetailModuleCount}
                    >
                      +
                    </button>
                  </div>
                  <em>{isActive ? "已加入，可继续加图" : "点击添加"}</em>
                  {referenceSummary ? (
                    <em className="module-reference-count">
                      {referenceSummary}
                    </em>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeModule === "white_background" ? (
        <section className="setting-group">
          <div className="setting-group-heading">
            <span>AI工具</span>
            <small>选择要生成的工具类型</small>
          </div>
          <div className="segmented-control" aria-label="AI工具">
            {whiteBackgroundModes.map((mode) => {
              const isActive = mode.value === whiteBackgroundMode;

              return (
                <button
                  type="button"
                  key={mode.value}
                  className={`${isActive ? "is-active" : ""}${
                    !hasProduct && !isActive ? " is-disabled" : ""
                  }`.trim() || undefined}
                  aria-pressed={isActive}
                  aria-disabled={!hasProduct && !isActive}
                  onClick={() => selectWhiteBackgroundMode(mode.value)}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          {whiteBackgroundMode === "outfit_change" ? (
            <div className="outfit-change-target-card">
              <div className="setting-group-heading">
                <span>换装服饰</span>
                <small>多上传 1 张要换上的衣服，作为 Image 2 参考</small>
              </div>
              <label className="outfit-change-upload">
                <span>上传要换上的服饰图</span>
                <small>建议使用清晰正面或半身服饰图</small>
                <input
                  aria-label="上传要换上的服饰图"
                  type="file"
                  accept="image/*"
                  onChange={handleOutfitChangeTargetFileChange}
                />
              </label>
              {outfitChangeTargetAsset ? (
                <div className="outfit-change-target-preview">
                  <img
                    src={outfitChangeTargetAsset.imageUrl}
                    alt="要换上的服饰图"
                  />
                  <div>
                    <p className="file-label">已选择服饰</p>
                    <p className="file-name">
                      {outfitChangeTargetAsset.fileName}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={removeOutfitChangeTargetAsset}
                  >
                    删除
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeModule === "lifestyle" ? (
        <section className="setting-group inspiration-creator-group" aria-labelledby="inspiration-controls">
          <div className="setting-group-heading">
            <span id="inspiration-controls">创作控制</span>
            <small>Image 1 是商品，Image 2 只作为灵感参考</small>
          </div>
          <div className="inspiration-control-grid">
            {inspirationControls.map((control) => (
              <div className="field" key={control.key}>
                <label htmlFor={`inspiration-${control.key}`}>{control.label}</label>
                <select
                  id={`inspiration-${control.key}`}
                  value={inspirationSettings[control.key]}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (control.key === "background") updateInspirationSetting("background", value as InspirationBackground);
                    if (control.key === "pose") updateInspirationSetting("pose", value as InspirationPose);
                    if (control.key === "model") updateInspirationSetting("model", value as InspirationModel);
                    if (control.key === "composition") updateInspirationSetting("composition", value as InspirationComposition);
                    if (control.key === "purpose") updateInspirationSetting("purpose", value as InspirationPurpose);
                    if (control.key === "productHandling") updateInspirationSetting("productHandling", value as InspirationProductHandling);
                  }}
                >
                  {control.options.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <label className="inspiration-reference-upload">
            <span>上传灵感参考图</span>
            <small>可上传模特、背景、姿态或构图参考，最多 1 张</small>
            <input
              type="file"
              accept="image/*"
              aria-label="上传灵感参考图"
              onChange={handleInspirationReferenceFileChange}
            />
          </label>
          {inspirationReferenceImage ? (
            <div className="inspiration-reference-preview">
              <img src={inspirationReferenceImage.imageUrl} alt="已上传的灵感参考图" />
              <div>
                <strong>{inspirationReferenceImage.fileName}</strong>
                <span>作为 Image 2 参考，不替换商品</span>
              </div>
              <button type="button" className="secondary-button" onClick={removeInspirationReference}>删除</button>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="inspiration-reference-note">参考说明</label>
            <textarea
              id="inspiration-reference-note"
              rows={3}
              value={inspirationNote}
              onChange={(event) => updateInspirationNote(event.target.value)}
              placeholder="例如：参考这张图的模特姿态和室内背景，但保留我的商品款式、颜色和细节。"
            />
          </div>
        </section>
      ) : null}

      {activeModule !== "white_background" ? (
        <div className="setting-group">
          <div className="field">
            <label htmlFor="output-language">输出语言</label>
            <select
              id="output-language"
              value={outputLanguage}
              onChange={(event) => {
                setOutputLanguage(event.target.value);
                updateConfig("outputLanguage", event.target.value);
              }}
            >
              {outputLanguages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="setting-group">
        <div className="setting-group-heading">
          <span>尺寸</span>
          <small>按页面预设</small>
        </div>
        <div className="segmented-control" aria-label="尺寸">
          {aspectRatioOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={config.aspectRatio === option.value ? "is-active" : undefined}
              aria-pressed={config.aspectRatio === option.value}
              onClick={() => updateConfig("aspectRatio", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <div className="setting-group-heading">
          <span>分辨率</span>
          <small>可切换</small>
        </div>
        <div className="segmented-control" aria-label="分辨率">
          {resolutionOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={resolution === option ? "is-active" : undefined}
              aria-pressed={resolution === option}
              onClick={() => updateConfig("resolution", option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {activeModule !== "white_background" ? (
        <>
          <div className="field">
            <label htmlFor="selling-points">
              {activeModule === "detail_page"
                ? "组图要求"
                : activeModule === "lifestyle"
                  ? "创作要求"
                  : "设计简报"}
            </label>
            <textarea
              id="selling-points"
              value={config.sellingPoints}
              rows={activeModule === "detail_page" ? 6 : activeModule === "lifestyle" ? 4 : 4}
              onChange={(event) => updateConfig("sellingPoints", event.target.value)}
              placeholder={
                activeModule === "detail_page"
                  ? "描述您的产品信息和期望的图片风格。例如：这是一款法式复古连衣裙，采用重磅真丝面料，特色是蕾丝拼接和珍珠扣设计，适合25-35岁都市女性通勤或约会穿。"
                  : activeModule === "lifestyle"
                    ? "补充你希望保留或强调的商品细节、画面气质和内容要求。"
                  : "描述产品核心卖点、视觉方向和希望强调的主图风格。"
              }
            />
          </div>

          <div className="field">
            <label htmlFor="promotion-info">
              {activeModule === "lifestyle" ? "画面文字" : "促销信息"}
            </label>
            <textarea
              id="promotion-info"
              value={config.specifications}
              rows={4}
              onChange={(event) =>
                updateConfig("specifications", event.target.value)
              }
              placeholder={activeModule === "lifestyle" ? "需要出现在画面中的商品名称、卖点或短文案。" : "填写促销活动详情，如折扣信息、活动名称、优惠力度等。"}
            />
          </div>
        </>
      ) : null}

      <div className="setting-group">
        <div className="setting-group-heading">
          <span>出图版本</span>
          <small>成功后扣点</small>
        </div>
        <div className="version-grid">
          {versionOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={
                generationVersion === option.value ? "is-active" : undefined
              }
              aria-pressed={generationVersion === option.value}
              onClick={() => updateConfig("generationVersion", option.value)}
            >
              {option.recommended ? <em>推荐</em> : null}
              <strong>{option.name}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="generation-footer">
        <div className="generation-summary">
          <span>
            {activeModule === "white_background"
              ? activeAiToolLabel
              : moduleDisplayLabels[activeModule]}
          </span>
          <span>{config.aspectRatio}</span>
          <span>{resolution}</span>
          <span>
            {
              versionOptions.find((option) => option.value === generationVersion)
                ?.name
            }
          </span>
        </div>
        <button
          type="button"
          className="primary-button generate-button"
          onClick={isOutOfCredits ? onBuyCredits : handleGenerateClick}
          disabled={!isOutOfCredits && isGenerateDisabled}
        >
          {isOutOfCredits
            ? "购买积分"
            : `生成${
                activeModule === "white_background"
                  ? activeAiToolLabel
                  : moduleDisplayLabels[activeModule]
              }`}
        </button>
        <p>
          {`预计消耗 ${estimatedCredits} 积分（${estimatedImageCount} 张 × ${resolution} 每张 ${resolutionCreditCost} 分${generationVersion === "brand" ? ` + 品牌版 ${brandVersionExtraCredits} 分` : ""}），失败不扣点。当前进行中 ${runningTaskCount}。${isOutOfCredits ? "当前余额不足，请购买积分后继续生成。" : ""}`}
        </p>
      </div>
    </aside>
      {editingReferenceModule ? createPortal(
        <div
          className="module-reference-modal-backdrop"
          role="presentation"
          onClick={() => setEditingReferenceModule(null)}
        >
          <section
            className="module-reference-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="module-reference-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="module-reference-modal-heading">
              <div>
                <p className="eyebrow">Module Material</p>
                <h3 id="module-reference-title">
                  {editingReferenceModule.title}素材
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭素材弹窗"
                onClick={() => setEditingReferenceModule(null)}
              >
                ×
              </button>
            </div>
            <label className="module-reference-upload">
              <span>上传模块参考图</span>
              <small>最多 {maxModuleReferenceAssets} 张，作为 Image 2 参考素材</small>
              <input
                aria-label="上传模块参考图"
                type="file"
                accept="image/*"
                multiple
                onChange={handleReferenceFilesChange}
              />
            </label>
            {draftImageReferenceAssets.length > 0 ? (
              <div className="module-reference-list">
                {draftImageReferenceAssets.map((asset) => (
                  <div className="module-reference-item" key={asset.id}>
                    <img src={asset.imageUrl} alt={asset.fileName} />
                    <span>{asset.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeDraftReferenceAsset(asset.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="module-reference-note">素材备注</label>
              <textarea
                id="module-reference-note"
                rows={4}
                value={draftReferenceNote}
                onChange={(event) => setDraftReferenceNote(event.target.value)}
                placeholder="例如：这是我的包装盒，请在包装展示中使用；这是红色和蓝色款，请用于多色套装。"
              />
            </div>
            <div className="module-reference-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingReferenceModule(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={saveReferenceAssets}
              >
                保存素材
              </button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
      <NoticeDialog
        open={showProductRequiredNotice}
        title="请先上传商品图"
        message="上传商品图后才能选择生成模块，避免生成与商品无关的无效图片。"
        onClose={() => setShowProductRequiredNotice(false)}
      />
      <NoticeDialog
        open={showOutfitChangeRequiredNotice}
        title="请上传换装服饰"
        message="换装需要额外上传一张目标服饰图，系统会将它作为 Image 2 参考。"
        onClose={() => setShowOutfitChangeRequiredNotice(false)}
      />
    </>
  );
}
