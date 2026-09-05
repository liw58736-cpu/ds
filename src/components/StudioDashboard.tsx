import {
  loadWorkspaceDrafts,
  workspaceModules,
} from "../storage/workspaceDraftStore";
import type { AppPage } from "./AppShell";
const labels = {
  main_image: "商品主图",
  detail_page: "详情页",
  white_background: "AI工具",
  lifestyle: "灵感创作",
};
export function StudioDashboard({
  onNavigate,
}: {
  onNavigate: (page: AppPage) => void;
}) {
  const drafts = loadWorkspaceDrafts();
  return (
    <main className="page-surface studio-dashboard">
      <section className="page-heading">
        <p className="eyebrow">KROMA STUDIO</p>
        <h1>继续你的创作</h1>
        <p>从图片库选图，生成素材，再到任务中心查看与下载。</p>
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
        {workspaceModules.map((module) => (
          <article className="panel" key={module}>
            <h2>{labels[module]}</h2>
            <p>
              {drafts[module].product
                ? `已选择：${drafts[module].product!.fileName}`
                : "尚未选择图片"}
            </p>
            <p>
              {drafts[module].config.sellingPoints ||
                "图片、模块与文字会独立保存为本机草稿。"}
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onNavigate(module === "lifestyle" ? "inspiration" : module)
              }
            >
              {drafts[module].product ? "继续编辑" : "开始创作"}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
