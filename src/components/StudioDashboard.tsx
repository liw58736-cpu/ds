import {
  loadWorkspaceDrafts,
  workspaceModules,
} from "../storage/workspaceDraftStore";
import type { AppPage } from "./AppShell";
import { ArrowUpRight, Image, Layers3, WandSparkles, Sparkles } from "lucide-react";
const labels = {
  main_image: "商品主图",
  detail_page: "详情页",
  white_background: "AI工具",
  lifestyle: "灵感创作",
};
const tools = {
  main_image: { icon: Image, caption: "让商品成为画面的主角", summary: "首屏 KV、商品特写与场景主图" },
  detail_page: { icon: Layers3, caption: "把卖点讲得更清楚", summary: "模块化组图，串联完整商品故事" },
  white_background: { icon: WandSparkles, caption: "细节调整，一步到位", summary: "白底、精修、换装与换模特" },
  lifestyle: { icon: Sparkles, caption: "从灵感走向新画面", summary: "保留参考场景，替换你的产品" },
};
export function StudioDashboard({
  onNavigate,
}: {
  onNavigate: (page: AppPage) => void;
}) {
  const drafts = loadWorkspaceDrafts();
  return (
    <main className="page-surface studio-dashboard">
      <section className="page-heading dashboard-intro">
        <div>
        <p className="eyebrow">KROMA STUDIO</p>
        <h1>继续你的创作</h1>
        <p>从图片库选图，生成素材，再到任务中心查看与下载。</p>
        </div>
        <div className="library-toolbar">
          <button
            type="button"
            className="primary-button"
            onClick={() => onNavigate("materials")}
          >
            打开图片库
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNavigate("history")}
          >
            查看任务中心
          </button>
        </div>
      </section>
      <section className="dashboard-drafts">
        {workspaceModules.map((module) => {
          const ToolIcon = tools[module].icon;
          return (
          <article className="panel dashboard-tool-card" data-tool={module} key={module}>
            <div className="dashboard-card-top">
              <span className="dashboard-tool-icon"><ToolIcon aria-hidden="true" /></span>
              <span className="dashboard-draft-state">{drafts[module].product ? "已保存草稿" : "新建画面"}</span>
            </div>
            <div className="dashboard-card-body">
            <div>
            <h2>{labels[module]}</h2>
            <p className="dashboard-caption">{tools[module].caption}</p>
            <p>
              {drafts[module].product
                ? `已选择：${drafts[module].product!.fileName}`
                : tools[module].summary}
            </p>
            <p>
              {drafts[module].config.sellingPoints ||
                "素材与设置自动保存，随时继续。"}
            </p>
            </div>
            {drafts[module].product ? <img className="dashboard-draft-image" src={drafts[module].product!.imageUrl} alt={`${labels[module]}草稿素材`} loading="lazy" /> : null}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onNavigate(module === "lifestyle" ? "inspiration" : module)
              }
            >
              {drafts[module].product ? "继续编辑" : "开始创作"}<ArrowUpRight aria-hidden="true" />
            </button>
          </article>
        );})}
      </section>
    </main>
  );
}
