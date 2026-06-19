import { useMemo, useState } from "react";
import { moduleLabels } from "../domain/defaults";
import type {
  AspectRatio,
  DetailPageModuleId,
  GenerationConfig,
  GenerationModule,
  GenerationResolution,
  MainImageModuleId,
  ShadowMode,
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
  hasRunningTask: boolean;
  isOutOfCredits?: boolean;
}

const pageMeta = {
  main_image: {
    eyebrow: "Main Image Settings",
    title: "商品主图生成",
    description: "选择主图结构、尺寸和促销信息，生成适合首图转化的素材。",
  },
  white_background: {
    eyebrow: "White Background Settings",
    title: "白底图生成",
    description: "专注干净抠图、白底陈列和平台审核友好的主视觉。",
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

const aspectRatioOptions: Array<{ value: AspectRatio; label: string }> = [
  { value: "1:1", label: "1:1 方图" },
  { value: "4:5", label: "4:5 竖图" },
  { value: "16:9", label: "16:9 横图" },
  { value: "long_page", label: "详情长图" },
];

const outputLanguages = ["中文", "English"];
const resolutionOptions: GenerationResolution[] = ["1K", "2K", "4K"];
const versionOptions = [
  { name: "标准版", description: "快速出图，适合批量 SKU" },
  { name: "品牌版", description: "更重质感、光影和转化表达", recommended: true },
];

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
  { value: "pure_white", label: "纯白背景" },
  { value: "transparent", label: "透明底" },
  { value: "light_gray", label: "浅灰检视" },
];
const shadowModes: Array<{ value: ShadowMode; label: string }> = [
  { value: "natural", label: "自然阴影" },
  { value: "none", label: "无阴影" },
  { value: "contact_shadow", label: "轻微接触阴影" },
];

export function ParameterPanel({
  activeModule,
  config,
  onChange,
  onGenerate,
  onBuyCredits,
  isGenerateDisabled,
  hasRunningTask,
  isOutOfCredits = false,
}: ParameterPanelProps) {
  const [outputLanguage, setOutputLanguage] = useState(outputLanguages[0]);
  const [version, setVersion] = useState("品牌版");
  const resolution = config.resolution ?? "2K";
  const selectedMainModules = config.selectedMainModules ?? [];
  const detailCounts = config.detailModuleCounts ?? {};
  const whiteBackgroundMode = config.whiteBackgroundMode ?? "pure_white";
  const shadowMode = config.shadowMode ?? "natural";
  const meta = pageMeta[activeModule];
  const selectedDetailCount = useMemo(
    () => Object.values(detailCounts).reduce((sum, count) => sum + count, 0),
    [detailCounts],
  );

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

  const toggleDetailModule = (moduleId: DetailPageModuleId) => {
    onChange({
      ...config,
      detailModuleCounts: {
        ...detailCounts,
        [moduleId]: detailCounts[moduleId] ? 0 : 1,
      },
    });
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
        value={moduleLabels[config.module]}
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

              return (
                <button
                  type="button"
                  key={module.id}
                  className={`module-card-button${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => toggleMainModule(module.id)}
                >
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeModule === "detail_page" ? (
        <section className="setting-group" aria-labelledby="detail-modules">
          <div className="setting-group-heading">
            <span id="detail-modules">服装详情内容模块</span>
            <small>点击未选模块会添加 1 张图。</small>
          </div>
          <p className="selection-count">已选 {selectedDetailCount}</p>
          <div className="detail-module-grid">
            {detailContentModules.map((module) => {
              const count = detailCounts[module.id] ?? 0;
              const isActive = count > 0;

              return (
                <button
                  type="button"
                  key={module.id}
                  className={`detail-module-button${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => toggleDetailModule(module.id)}
                >
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                  <b>{count}</b>
                  <em>{isActive ? "点击移除" : "点击添加"}</em>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeModule === "white_background" ? (
        <section className="setting-group">
          <div className="setting-group-heading">
            <span>白底处理</span>
            <small>可切换</small>
          </div>
          <div className="segmented-control" aria-label="白底处理">
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
          <div className="setting-group-heading setting-subheading">
            <span>阴影处理</span>
            <small>可切换</small>
          </div>
          <div className="segmented-control" aria-label="阴影处理">
            {shadowModes.map((mode) => (
              <button
                type="button"
                key={mode.value}
                className={mode.value === shadowMode ? "is-active" : undefined}
                aria-pressed={mode.value === shadowMode}
                onClick={() => updateConfig("shadowMode", mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="setting-group">
        <div className="field">
          <label htmlFor="output-language">输出语言</label>
          <select
            id="output-language"
            value={outputLanguage}
            onChange={(event) => setOutputLanguage(event.target.value)}
          >
            {outputLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
      </div>

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
              ? "描述您的产品信息和期望的图片风格。例如：这是一款法式复古连衣裙，采用重磅真丝面料，特色是精致的蕾丝拼接和珍珠扣设计，适合25-35岁都市女性通勤或约会穿。"
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

      <div className="setting-group">
        <div className="setting-group-heading">
          <span>出图版本</span>
          <small>成功后扣点</small>
        </div>
        <div className="version-grid">
          {versionOptions.map((option) => (
            <button
              type="button"
              key={option.name}
              className={version === option.name ? "is-active" : undefined}
              aria-pressed={version === option.name}
              onClick={() => setVersion(option.name)}
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
          <span>{moduleLabels[activeModule]}</span>
          <span>{config.aspectRatio}</span>
          <span>{resolution}</span>
          <span>{version}</span>
        </div>
        <button
          type="button"
          className="primary-button generate-button"
          onClick={isOutOfCredits ? onBuyCredits : onGenerate}
          disabled={hasRunningTask || (!isOutOfCredits && isGenerateDisabled)}
        >
          {isOutOfCredits
            ? "购买积分"
            : hasRunningTask
              ? "生成中"
              : `生成${moduleLabels[activeModule]}`}
        </button>
        <p>
          {isOutOfCredits
            ? "试用额度已用完，购买积分后可继续生成。"
            : "预计消耗 1 credit，失败不计入成功消耗。"}
        </p>
      </div>
    </aside>
  );
}
