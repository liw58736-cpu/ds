import { ArrowRight, Brush, Film, Images, Layers3, Link2, Sparkles } from "lucide-react";
import { useState } from "react";
import detailAfterImage from "../assets/home/kroma-detail-after-v2.webp";
import detailBeforeImage from "../assets/home/kroma-detail-before-v2.webp";
import heroV2Image from "../assets/home/kroma-home-hero-v2.webp";
import mainBeforeImage from "../assets/home/kroma-main-before-v2.webp";
import scaleShowcaseImage from "../assets/home/kroma-scale-showcase-v2.webp";
import whiteAfterImage from "../assets/home/kroma-white-after-v2.webp";
import type { AppPage } from "./AppShell";

interface HomePageProps {
  onOpenStudio: (
    page: Extract<
      AppPage,
      "main_image" | "white_background" | "detail_page" | "inspiration" | "motion" | "materials"
    >,
  ) => void;
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
    afterImage: heroV2Image,
    bullets: ["卖点视觉化", "高端棚拍光感", "多模块批量出图"],
  },
  {
    page: "white_background",
    eyebrow: "WHITE BACKGROUND",
    title: "白底图和平台抠图",
    summary: "保留商品结构和材质，整理成平台审核友好的白底图、目录图和 SKU 图。",
    beforeLabel: "场景商品图",
    afterLabel: "白底成片",
    beforeImage: heroV2Image,
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

export function HomePage({ onOpenStudio }: HomePageProps) {
  const [activeShowcase, setActiveShowcase] = useState<StudioPage>("main_image");

  return (
    <main className="home-page kroma-home">
      <section className="kroma-home-hero" aria-labelledby="home-title">
        <div className="kroma-home-hero-copy">
          <p className="kroma-home-eyebrow"><Sparkles aria-hidden="true" /> KROMA · AI COMMERCE STUDIO</p>
          <h1 id="home-title" aria-label="AI 商品图，一键生成可上架素材">
            <span>一张商品图</span>
            <span>完成全套上新</span>
          </h1>
          <p>
            从主图、白底图到详情页与社媒内容，围绕真实商品持续生成可直接使用的电商素材。
          </p>
          <div className="kroma-home-hero-actions">
            <button type="button" className="primary-button" onClick={() => onOpenStudio("main_image")}>
              <Sparkles aria-hidden="true" />
              <span>开始生成商品图</span>
            </button>
            <button type="button" className="secondary-button" onClick={() => onOpenStudio("detail_page")}>
              <Layers3 aria-hidden="true" />
              <span>生成详情页组图</span>
            </button>
          </div>
          <div className="kroma-home-hero-benefits" aria-label="kroma 服务保证">
            <span>商品身份优先</span>
            <span>失败任务不扣点</span>
            <span>最高 4K 输出</span>
          </div>
        </div>
        <div className="kroma-home-hero-stage" aria-label="kroma 商品图生成展示">
          <figure className="kroma-home-stage-primary">
            <img src={heroV2Image} alt="kroma 商品图生成首页主视觉" />
          </figure>
        </div>
      </section>

      <section className="kroma-home-showcase" aria-labelledby="showcase-title">
        <header className="kroma-home-section-heading">
          <div>
            <p className="kroma-home-eyebrow">PRODUCTION DESK</p>
            <h2 id="showcase-title">一套视觉，覆盖上架到投放</h2>
          </div>
          <p>从商品身份出发，让不同页面的素材保持同一套产品细节与品牌调性。</p>
        </header>

        <div className="kroma-home-showcase-layout">
          <div className="kroma-home-showcase-tabs" role="tablist" aria-label="kroma 核心功能">
            {featureModules.map((module, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={module.page === activeShowcase}
                className={module.page === activeShowcase ? "is-active" : undefined}
                key={module.page}
                onClick={() => setActiveShowcase(module.page)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{module.title}</strong>
                <small>{module.summary}</small>
              </button>
            ))}
          </div>

          <div className="kroma-home-showcase-panels">
            {featureModules.map((module) => (
              <article
                className={`kroma-home-showcase-panel${module.page === activeShowcase ? " is-active" : ""}`}
                role="tabpanel"
                hidden={module.page !== activeShowcase}
                key={module.page}
                aria-label={module.title}
              >
                <div className="kroma-home-showcase-toolbar">
                  <div>
                    <p className="kroma-home-eyebrow">{module.eyebrow}</p>
                    <h3>{module.title}</h3>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => onOpenStudio(module.page)}>
                    <span>打开工作台</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                </div>
                <div className="kroma-home-before-after" aria-label={`${module.title}前后对比`}>
                  <figure>
                    <span>{module.beforeLabel}</span>
                    <img src={module.beforeImage} alt={`${module.title}出图前`} />
                  </figure>
                  <figure className="is-after">
                    <span>{module.afterLabel}</span>
                    <img src={module.afterImage} alt={`${module.title}出图后`} />
                  </figure>
                </div>
                <ul className="kroma-home-showcase-points">
                  {module.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kroma-home-content-tools" aria-labelledby="content-tools-title">
        <header className="kroma-home-section-heading">
          <div>
            <p className="kroma-home-eyebrow">CONTENT WORKFLOW</p>
            <h2 id="content-tools-title">从参考素材到动态内容</h2>
          </div>
          <p>提取爆款笔记素材、完成换品创作，再生成适合发布的 Live 图。</p>
        </header>
        <div className="kroma-home-content-grid">
          <article><Link2 aria-hidden="true" /><span>01</span><h3>链接提取与素材库</h3><p>粘贴小红书分享文案，多选需要的照片并保存到个人素材库。</p><button type="button" onClick={() => onOpenStudio("materials")}>打开素材库<ArrowRight aria-hidden="true" /></button></article>
          <article><Film aria-hidden="true" /><span>02</span><h3>生成 Live 图</h3><p>选择 720P、1080P 或 2K，添加推进、拉远、横移或漂移动效并下载 WebM。</p><button type="button" onClick={() => onOpenStudio("motion")}>打开 Live 图<ArrowRight aria-hidden="true" /></button></article>
          <article><Brush aria-hidden="true" /><span>03</span><h3>换品灵感创作</h3><p>保持灵感原图的人物和场景，将第二张产品或服装自然替换进去。</p><button type="button" onClick={() => onOpenStudio("inspiration")}>新建创作任务<ArrowRight aria-hidden="true" /></button></article>
        </div>
      </section>

      <section className="kroma-home-output" aria-labelledby="output-title">
        <img src={scaleShowcaseImage} alt="kroma 批量商品图展示" />
        <div className="kroma-home-output-copy">
          <p className="kroma-home-eyebrow">BATCH READY</p>
          <h2 id="output-title">不是一张效果图，是一整套可交付素材</h2>
          <p>主图、白底图、详情模块和历史任务保持连续，让上新素材能够按同一套标准持续产出。</p>
          <div className="kroma-home-output-facts">
            <span><strong>1K / 2K / 4K</strong>多分辨率输出</span>
            <span><strong>失败不扣点</strong>任务结果可追溯</span>
          </div>
        </div>
      </section>

      <section className="kroma-home-cta" aria-labelledby="home-cta-title">
        <div>
          <Images aria-hidden="true" />
          <p className="kroma-home-eyebrow">READY TO CREATE</p>
          <h2 id="home-cta-title">从下一张商品图开始</h2>
          <p>进入工作台，按当前店铺需要选择主图、白底图或详情页模块。</p>
        </div>
        <button type="button" className="primary-button" onClick={() => onOpenStudio("main_image")}>
          <span>打开商品主图工作台</span>
          <ArrowRight aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}
