import { type ChangeEvent, useMemo, useState } from "react";
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
  MainImageModuleId,
  ModuleReferenceAsset,
  WhiteBackgroundMode,
} from "../domain/types";

type StudioModule = Extract<
  GenerationModule,
  "main_image" | "white_background" | "detail_page"
>;

interface ParameterPanelProps {
  activeModule: StudioModule;
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
  onGenerate: () => void;
  onBuyCredits?: () => void;
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
} as const satisfies Record<
  StudioModule,
  { eyebrow: string; title: string; description: string }
>;

const moduleDisplayLabels: Record<StudioModule, string> = {
  main_image: "商品主图",
  white_background: "AI工具",
  detail_page: "详情页",
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
export function ParameterPanel({
  activeModule,
  config,
  onChange,
  onGenerate,
  onBuyCredits,
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
  const resolution = config.resolution ?? "1K";
  const generationVersion = config.generationVersion ?? "brand";
  const selectedMainModules = config.selectedMainModules ?? [];
  const detailCounts = config.detailModuleCounts ?? {};
  const moduleReferenceAssets = config.moduleReferenceAssets ?? {};
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

  const toggleMainModule = (moduleId: MainImageModuleId) => {
    const nextModules = selectedMainModules.includes(moduleId)
      ? selectedMainModules.filter((currentModule) => currentModule !== moduleId)
      : [...selectedMainModules, moduleId];

    onChange({ ...config, selectedMainModules: nextModules });
  };

  const setDetailModuleCount = (
    moduleId: DetailPageModuleId,
    nextCount: number,
  ) => {
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

  const getReferenceAssets = (moduleId: string): ModuleReferenceAsset[] =>
    moduleReferenceAssets[moduleId] ?? [];

  const openReferenceEditor = (moduleId: string, title: string) => {
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
      maxModuleReferenceAssets - draftReferenceAssets.length,
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

  const saveReferenceAssets = () => {
    if (!editingReferenceModule) {
      return;
    }

    const note = draftReferenceNote.trim();
    const nextReferenceAssets = { ...moduleReferenceAssets };
    const savedAssets = draftReferenceAssets.map((asset) => ({
      ...asset,
      ...(note ? { note } : {}),
    }));

    if (savedAssets.length > 0) {
      nextReferenceAssets[editingReferenceModule.id] = savedAssets;
    } else {
      delete nextReferenceAssets[editingReferenceModule.id];
    }

    onChange({
      ...config,
      moduleReferenceAssets:
        Object.keys(nextReferenceAssets).length > 0
          ? nextReferenceAssets
          : undefined,
    });
    setEditingReferenceModule(null);
    setDraftReferenceAssets([]);
    setDraftReferenceNote("");
  };

  const removeDraftReferenceAsset = (assetId: string) => {
    setDraftReferenceAssets((currentAssets) =>
      currentAssets.filter((asset) => asset.id !== assetId),
    );
  };

  return (
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
              const referenceCount = getReferenceAssets(module.id).length;

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={module.id}
                  className={`module-card-button${isActive ? " is-active" : ""}`}
                  aria-label={`${module.title} ${module.description}`}
                  aria-pressed={isActive}
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
                  {referenceCount > 0 ? (
                    <em className="module-reference-count">
                      已加 {referenceCount} 张素材
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
              const referenceCount = getReferenceAssets(module.id).length;

              return (
                <div
                  key={module.id}
                  role="button"
                  tabIndex={0}
                  className={`detail-module-button${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
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
                  {referenceCount > 0 ? (
                    <em className="module-reference-count">
                      已加 {referenceCount} 张素材
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
            {whiteBackgroundModes.map((mode) => (
              <button
                type="button"
                key={mode.value}
                className={
                  mode.value === whiteBackgroundMode ? "is-active" : undefined
                }
                aria-pressed={mode.value === whiteBackgroundMode}
                onClick={() => updateConfig("whiteBackgroundMode", mode.value)}
              >
                {mode.label}
              </button>
            ))}
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
              {activeModule === "detail_page" ? "组图要求" : "设计简报"}
            </label>
            <textarea
              id="selling-points"
              value={config.sellingPoints}
              rows={activeModule === "detail_page" ? 6 : 4}
              onChange={(event) => updateConfig("sellingPoints", event.target.value)}
              placeholder={
                activeModule === "detail_page"
                  ? "描述您的产品信息和期望的图片风格。例如：这是一款法式复古连衣裙，采用重磅真丝面料，特色是蕾丝拼接和珍珠扣设计，适合25-35岁都市女性通勤或约会穿。"
                  : "描述产品核心卖点、视觉方向和希望强调的主图风格。"
              }
            />
            {activeModule === "detail_page" ? (
              <p className="field-hint">
                建议输入：款式名称、面料材质、设计亮点、适合人群、风格调性等。输入组图要求并选择输出语言后，系统会自动分析产品并生成共享文案。
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="promotion-info">促销信息</label>
            <textarea
              id="promotion-info"
              value={config.specifications}
              rows={4}
              onChange={(event) =>
                updateConfig("specifications", event.target.value)
              }
              placeholder="填写促销活动详情，如折扣信息、活动名称、优惠力度等。"
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
          onClick={isOutOfCredits ? onBuyCredits : onGenerate}
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
      {editingReferenceModule ? (
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
            {draftReferenceAssets.length > 0 ? (
              <div className="module-reference-list">
                {draftReferenceAssets.map((asset) => (
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
        </div>
      ) : null}
    </aside>
  );
}
