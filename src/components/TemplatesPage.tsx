const templates = [
  {
    name: "Amazon 主图",
    description: "适合 1:1 白底、阴影控制和平台审核前检查。",
    meta: "主图 / 白底 / 1:1",
  },
  {
    name: "Shopify Banner",
    description: "面向独立站首屏横幅，保留商品识别和促销信息空间。",
    meta: "Banner / 16:9 / WebP",
  },
  {
    name: "详情页长图",
    description: "组织卖点、规格和局部细节，输出适合详情页的长图结构。",
    meta: "详情页 / 长图 / JPG",
  },
  {
    name: "生活方式场景",
    description: "把商品放入可复用的海外电商场景，便于素材批量测试。",
    meta: "场景图 / 4:5 / PNG",
  },
];

export function TemplatesPage() {
  return (
    <main className="page-surface">
      <div className="page-heading">
        <p className="eyebrow">Templates</p>
        <h1>模板库</h1>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <article className="template-card" key={template.name}>
            <p className="card-meta">{template.meta}</p>
            <h2>{template.name}</h2>
            <p>{template.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
