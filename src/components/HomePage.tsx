import heroImage from "../assets/home/home-hero-product-photo.png";
import detailAfterImage from "../assets/home/home-detail-after.png";
import detailBeforeImage from "../assets/home/home-detail-before.png";
import mainAfterImage from "../assets/home/home-main-after.png";
import mainBeforeImage from "../assets/home/home-main-before.png";
import whiteAfterImage from "../assets/home/home-white-after.png";
import whiteBeforeImage from "../assets/home/home-white-before.png";
import type { AppPage } from "./AppShell";

interface HomePageProps {
  onOpenStudio: (page: Extract<AppPage, "main_image" | "white_background" | "detail_page">) => void;
}

const productionModules: Array<{
  title: string;
  eyebrow: string;
  description: string;
  intro: string;
  points: Array<{ title: string; text: string }>;
  beforeLabel: string;
  afterLabel: string;
  beforeImage: string;
  afterImage: string;
  page: Extract<AppPage, "main_image" | "white_background" | "detail_page">;
}> = [
  {
    title: "商品主图 KV",
    eyebrow: "Main Image",
    description: "把普通商品素材整理成更适合首屏转化的主视觉。",
    intro: "上传商品图后，系统会分析产品结构、材质和卖点，生成适合首屏转化的电商主图。",
    points: [
      { title: "商品特征分析", text: "识别颜色、材质、包装和核心卖点，减少手动整理。" },
      { title: "平台化出图", text: "适合 Amazon、Shopify、独立站和社媒投放的主视觉。" },
      { title: "品牌安全控制", text: "保持商品识别度，同时统一灯光、构图和调性。" },
    ],
    beforeLabel: "普通商品素材",
    afterLabel: "电商主图成片",
    beforeImage: mainBeforeImage,
    afterImage: mainAfterImage,
    page: "main_image",
  },
  {
    title: "白底图 / 抠图",
    eyebrow: "White Background",
    description: "去掉复杂环境，生成干净边缘、自然阴影的平台目录图。",
    intro: "把带场景的商品图整理成平台审核友好的白底图，适合目录、SKU 和投放素材。",
    points: [
      { title: "边缘净化", text: "去除复杂背景，保留商品轮廓和透明质感。" },
      { title: "阴影控制", text: "自动补充自然落影，避免商品漂浮或过度抠图感。" },
      { title: "批量目录", text: "适合多 SKU 商品统一成干净的电商目录图。" },
    ],
    beforeLabel: "带场景原图",
    afterLabel: "白底商品图",
    beforeImage: whiteBeforeImage,
    afterImage: whiteAfterImage,
    page: "white_background",
  },
  {
    title: "服装详情页组图",
    eyebrow: "Detail Page",
    description: "把单张服装图扩展成面料、细节、色卡和搭配模块。",
    intro: "从服装参考图出发，自动规划详情页模块，并生成覆盖卖点、面料、尺码和场景的组图。",
    points: [
      { title: "模块规划", text: "按主图展示、面料工艺、版型剪裁、搭配推荐等模块组织内容。" },
      { title: "整套表达", text: "一组图讲清楚穿着效果、细节质感和购买理由。" },
      { title: "活动适配", text: "可加入促销信息、权益保障和品牌调性要求。" },
    ],
    beforeLabel: "单张服装图",
    afterLabel: "详情页组图",
    beforeImage: detailBeforeImage,
    afterImage: detailAfterImage,
    page: "detail_page",
  },
];

const platformLabels = [
  "Amazon",
  "Shopify",
  "TikTok Shop",
  "Shopee",
  "Lazada",
  "独立站",
  "淘宝",
  "天猫",
  "小红书",
  "SHEIN",
];

export function HomePage({ onOpenStudio }: HomePageProps) {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <img className="home-hero-image" src={heroImage} alt="单商品电商主图展示" />
        <div className="home-hero-copy">
          <p className="eyebrow">kroma AI Image Studio</p>
          <h1 id="home-title">一键上传 即刻成片</h1>
          <p>
            面向跨境电商卖家的 AI 生图工作台。从商品主图、白底图到服装详情页组图，上传商品图后快速生成可上架、可投放、可复用的商业素材。
          </p>
          <div className="home-hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenStudio("main_image")}
            >
              进入工作台
            </button>
            <button
              type="button"
              className="secondary-button home-secondary-button"
              onClick={() => onOpenStudio("detail_page")}
            >
              查看详情页生成
            </button>
          </div>
          <div className="home-hero-capabilities" aria-label="首页功能入口">
            {productionModules.map((module) => (
              <button
                type="button"
                key={module.title}
                onClick={() => onOpenStudio(module.page)}
              >
                <strong>{module.title}</strong>
                <span>{module.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="home-platform-strip" aria-label="平台适配">
          <div>
            {platformLabels.concat(platformLabels).map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-flow-section" aria-labelledby="capabilities-title">
        <div className="home-section-heading home-flow-heading">
          <div>
            <p className="eyebrow">Production Modules</p>
            <h2 id="capabilities-title">按电商出图流程打磨每一种素材</h2>
          </div>
          <p>主图负责转化，白底图负责平台审核，详情页组图负责完整表达商品卖点。每个功能都保留清晰的出图前和出图后对比。</p>
        </div>
        <div className="home-flow-stack">
          {productionModules.map((module, index) => (
            <article className="home-flow-panel" key={module.title}>
              <div className="home-flow-copy">
                <span className="home-flow-index">{String(index + 1).padStart(2, "0")}</span>
                <p className="eyebrow">{module.eyebrow}</p>
                <h3>{module.title}</h3>
                <p>{module.intro}</p>
                <div className="home-flow-points">
                  {module.points.map((point) => (
                    <section key={point.title}>
                      <h4>{point.title}</h4>
                      <p>{point.text}</p>
                    </section>
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onOpenStudio(module.page)}
                >
                  开始生成
                </button>
              </div>
              <div className="home-flow-visual" aria-label={`${module.title}出图对比`}>
                <figure>
                  <span>原图</span>
                  <img src={module.beforeImage} alt={`${module.title}出图前：${module.beforeLabel}`} />
                  <figcaption>{module.beforeLabel}</figcaption>
                </figure>
                <figure>
                  <span>kroma 效果</span>
                  <img src={module.afterImage} alt={`${module.title}出图后：${module.afterLabel}`} />
                  <figcaption>{module.afterLabel}</figcaption>
                </figure>
              </div>
            </article>
          ))}
        </div>
      </section>

    </main>
  );
}
