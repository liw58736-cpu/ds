const plans = [
  {
    name: "Starter",
    price: "免费",
    credits: "每月 20 credits",
    description: "用于验证商品图、白底图和单品场景生成流程。",
  },
  {
    name: "Pro",
    price: "¥99 / 月",
    credits: "每月 600 credits",
    description: "适合稳定运营 Amazon、Shopify 和独立站素材。",
  },
  {
    name: "Studio",
    price: "¥299 / 月",
    credits: "每月 2,400 credits",
    description: "面向多店铺、多 SKU 的批量主图和详情页生产。",
  },
];

export function PricingPage() {
  return (
    <main className="page-surface">
      <div className="page-heading">
        <p className="eyebrow">Pricing</p>
        <h1>价格</h1>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article className="price-card" key={plan.name}>
            <h2>{plan.name}</h2>
            <p className="price-value">{plan.price}</p>
            <p className="credit-text">{plan.credits}</p>
            <p>{plan.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
