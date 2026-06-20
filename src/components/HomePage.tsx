import heroImage from "../assets/home/kroma-home-hero.webp";
import detailAfterImage from "../assets/home/kroma-detail-after.webp";
import detailBeforeImage from "../assets/home/kroma-detail-before.webp";
import mainAfterImage from "../assets/home/kroma-main-after.webp";
import mainBeforeImage from "../assets/home/kroma-main-before.webp";
import scaleShowcaseImage from "../assets/home/kroma-scale-showcase.webp";
import whiteAfterImage from "../assets/home/kroma-white-after.webp";
import whiteBeforeImage from "../assets/home/kroma-white-before.webp";
import type { AppPage } from "./AppShell";

interface HomePageProps {
  onOpenStudio: (page: Extract<AppPage, "main_image" | "white_background" | "detail_page">) => void;
}

type StudioPage = Extract<AppPage, "main_image" | "white_background" | "detail_page">;

interface FeatureModule {
  page: StudioPage;
  eyebrow: string;
  title: string;
  summary: string;
  beforeLabel: string;
  afterLabel: string;
  beforeImage: string;
  afterImage: string;
  bullets: string[];
}

const featureModules: FeatureModule[] = [
  {
    page: "main_image",
    eyebrow: "MAIN IMAGE",
    title: "商品主图和首屏 KV",
    summary: "把普通商品照重做成第一眼能卖货的主视觉，适合上架、投放和独立站首屏。",
    beforeLabel: "卖家原始图",
    afterLabel: "kroma 主图",
    beforeImage: mainBeforeImage,
    afterImage: mainAfterImage,
    bullets: ["卖点视觉化", "高端棚拍光感", "多模块批量出图"],
  },
  {
    page: "white_background",
    eyebrow: "WHITE BACKGROUND",
    title: "白底图和平台抠图",
    summary: "保留商品结构和材质，整理成平台审核友好的白底图、目录图和 SKU 图。",
    beforeLabel: "场景商品图",
    afterLabel: "白底成片",
    beforeImage: whiteBeforeImage,
    afterImage: whiteAfterImage,
    bullets: ["干净边缘", "自然接触阴影", "适合目录和广告"],
  },
  {
    page: "detail_page",
    eyebrow: "DETAIL PAGE",
    title: "服装详情页组图",
    summary: "从一张服装图扩展出主图、面料、版型、色卡、搭配和保障模块。",
    beforeLabel: "单张服装图",
    afterLabel: "详情页组图",
    beforeImage: detailBeforeImage,
    afterImage: detailAfterImage,
    bullets: ["模块化详情页", "面料细节展示", "整套视觉统一"],
  },
];

const capabilityCards = [
  {
    title: "上传商品图",
    text: "用商品图片作为核心输入，生成结果围绕真实商品展开。",
  },
  {
    title: "选择出图模块",
    text: "主图、白底图和详情页分开配置，每个页面只保留对应设置。",
  },
  {
    title: "生成可用素材",
    text: "失败不扣点，成功任务进入历史记录，方便复用和继续编辑。",
  },
  {
    title: "适配真实运营",
    text: "支持 1K、2K、4K 路由，适合上架、投放和详情页制作。",
  },
];

const audienceCards = [
  ["跨境卖家", "快速补齐新品主图、白底图和详情页素材。"],
  ["品牌小团队", "保持统一视觉调性，减少外包沟通成本。"],
  ["代运营团队", "把重复修图和详情页组图流程标准化。"],
];

export function HomePage({ onOpenStudio }: HomePageProps) {
  return (
    <main className="home-page pr-home">
      <section className="pr-hero" aria-labelledby="home-title">
        <div className="pr-hero-copy">
          <p className="pr-eyebrow">KROMA AI COMMERCE STUDIO</p>
          <h1 id="home-title">AI 商品图，一键生成可上架素材</h1>
          <p>
            参考专业商品图工作流，为电商卖家生成主图、白底图和服装详情页组图。
            上传商品图，选择模块，几分钟内拿到能用于店铺、广告和独立站的图片。
          </p>
          <div className="pr-hero-actions">
            <button type="button" className="primary-button" onClick={() => onOpenStudio("main_image")}>
              开始生成商品图
            </button>
            <button type="button" className="secondary-button" onClick={() => onOpenStudio("detail_page")}>
              生成详情页组图
            </button>
          </div>
          <div className="pr-hero-proof" aria-label="kroma 数据概览">
            <span>
              <strong>3</strong>
              核心页面
            </span>
            <span>
              <strong>20+</strong>
              详情模块
            </span>
            <span>
              <strong>4K</strong>
              高清输出
            </span>
          </div>
        </div>

        <div className="pr-hero-visual" aria-label="kroma 商品图生成展示">
          <figure className="pr-hero-main-shot">
            <img src={heroImage} alt="kroma 商品图生成首页主视觉" />
          </figure>
          <figure className="pr-floating-shot pr-floating-shot-main">
            <img src={mainAfterImage} alt="商品主图生成效果" />
            <figcaption>主图 KV</figcaption>
          </figure>
          <figure className="pr-floating-shot pr-floating-shot-white">
            <img src={whiteAfterImage} alt="白底图生成效果" />
            <figcaption>白底图</figcaption>
          </figure>
        </div>
      </section>

      <section className="pr-capability-section" aria-labelledby="capability-title">
        <div className="pr-section-heading">
          <p className="pr-eyebrow">PRODUCT WORKFLOW</p>
          <h2 id="capability-title">从商品图到完整电商素材</h2>
          <p>首页只展示核心能力，具体生成设置都进入对应工作台完成。</p>
        </div>
        <div className="pr-capability-grid">
          {capabilityCards.map((card) => (
            <article className="pr-capability-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pr-feature-stack" aria-label="kroma 核心功能">
        {featureModules.map((module, index) => (
          <article className="pr-feature-panel" key={module.page}>
            <div className="pr-feature-copy">
              <span className="pr-feature-number">{String(index + 1).padStart(2, "0")}</span>
              <p className="pr-eyebrow">{module.eyebrow}</p>
              <h2>{module.title}</h2>
              <p>{module.summary}</p>
              <ul>
                {module.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <button type="button" className="secondary-button" onClick={() => onOpenStudio(module.page)}>
                进入{module.title}
              </button>
            </div>
            <div className="pr-before-after" aria-label={`${module.title}前后对比`}>
              <figure>
                <span>{module.beforeLabel}</span>
                <img src={module.beforeImage} alt={`${module.title}出图前`} />
              </figure>
              <figure className="is-after">
                <span>{module.afterLabel}</span>
                <img src={module.afterImage} alt={`${module.title}出图后`} />
              </figure>
            </div>
          </article>
        ))}
      </section>

      <section className="pr-audience-section" aria-labelledby="audience-title">
        <div className="pr-section-heading">
          <p className="pr-eyebrow">WHO USES KROMA</p>
          <h2 id="audience-title">适合每天都要出图的电商团队</h2>
        </div>
        <div className="pr-audience-grid">
          {audienceCards.map(([title, text]) => (
            <article className="pr-audience-card" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pr-scale-section" aria-labelledby="scale-title">
        <div className="pr-scale-copy">
          <p className="pr-eyebrow">BATCH READY</p>
          <h2 id="scale-title">把单张商品图扩展成一整套运营素材</h2>
          <p>
            kroma 的重点不是做一张好看的图，而是把主图、白底图、详情页和历史任务串成稳定的电商生产流程。
          </p>
          <button type="button" className="primary-button" onClick={() => onOpenStudio("main_image")}>
            打开工作台
          </button>
        </div>
        <figure className="pr-scale-visual">
          <img src={scaleShowcaseImage} alt="kroma 批量商品图展示" />
        </figure>
      </section>
    </main>
  );
}
