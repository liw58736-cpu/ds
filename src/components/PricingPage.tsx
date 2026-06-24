import { useState } from "react";
import { getWebBackendHealth } from "../api/accountApi";
import {
  getMissingPaddleCheckoutConfig,
  isPaddleCheckoutConfigured,
  purchasePlan,
} from "../api/billingApi";
import { getAccountSnapshot } from "../storage/accountStore";
import type { WebBackendHealth } from "../api/accountApi";

type BillingType = "top-up" | "subscription";

interface CreditPlan {
  id: string;
  billingType: BillingType;
  eyebrow: string;
  name: string;
  badge?: string;
  originalPrice: string;
  currentPrice: string;
  period?: string;
  baseCredits: string;
  campaignCredits?: string;
  firstPurchaseBonus: string;
  cumulativeBonus?: string;
  description: string;
  features: string[];
  paymentNote?: string;
}

function parseCreditAmount(value: string): number {
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function isPaymentFulfillmentReady(health: WebBackendHealth | null): boolean {
  return Boolean(
    health?.config.paddleWebhookSecret &&
      health.config.paddlePriceCredits &&
      health.database?.webBillingEvents !== false,
  );
}

const topUpPlans: CreditPlan[] = [
  {
    id: "basic-top-up",
    billingType: "top-up",
    eyebrow: "TOP-UP",
    name: "基础包",
    originalPrice: "¥72",
    currentPrice: "¥36",
    baseCredits: "100 积分",
    campaignCredits: "120 积分",
    firstPurchaseBonus: "含首购赠送 20",
    description: "灵活充值，积分永不过期，适合少量主图和详情图试用。",
    features: [
      "单次充值权益",
      "按积分用量计费",
      "万能画板：上传 / 历史图编辑",
      "AI 编辑、裁剪、下载",
      "GPT Image 2 标准模型",
      "单次购买积分不过期",
    ],
  },
  {
    id: "standard-top-up",
    billingType: "top-up",
    eyebrow: "TOP-UP",
    name: "标准包",
    originalPrice: "¥216",
    currentPrice: "¥108",
    baseCredits: "360 积分",
    campaignCredits: "420 积分",
    firstPurchaseBonus: "含首购赠送 60",
    description: "主图、详情页和画板编辑都能稳定覆盖，适合固定上新。",
    features: [
      "单次充值权益",
      "万能画板：AI 编辑 + 文字替换",
      "智能图层分离、合成与下载",
      "主图 2.0 + 详情页生成",
      "支持 1K / 2K / 4K",
      "单次购买积分不过期",
    ],
  },
  {
    id: "pro-top-up",
    billingType: "top-up",
    eyebrow: "TOP-UP",
    name: "专业包",
    badge: "最受欢迎",
    originalPrice: "¥436",
    currentPrice: "¥218",
    baseCredits: "800 积分",
    campaignCredits: "950 积分",
    firstPurchaseBonus: "含首购赠送 150",
    description: "适合稳定店铺素材周转，覆盖主图、详情页和风格复刻。",
    features: [
      "万能画板完整基础能力",
      "详情页 16 模块、主图 2.0",
      "风格复刻、服装试穿 / 搭配",
      "GPT Image 2，支持 4K",
      "适合稳定店铺素材周转",
      "单次购买积分不过期",
    ],
  },
];

const subscriptionPlans: CreditPlan[] = [
  {
    id: "monthly-subscription",
    billingType: "subscription",
    eyebrow: "SUBSCRIPTION",
    name: "轻度创作首选",
    originalPrice: "¥144",
    currentPrice: "¥72",
    period: "/ 月",
    baseCredits: "220 积分",
    campaignCredits: "260 积分",
    firstPurchaseBonus: "含首购赠送 40",
    description: "每月固定积分，适合轻量持续创作。",
    features: [
      "持续创作权益",
      "按积分用量计费",
      "万能画板、主图、详情页、修图全可用",
      "GPT Image 2 标准模型",
      "到期后可手动续购",
    ],
    paymentNote: "Paddle Checkout",
  },
  {
    id: "quarterly-subscription",
    billingType: "subscription",
    eyebrow: "SUBSCRIPTION",
    name: "稳定创作更划算",
    originalPrice: "¥404",
    currentPrice: "¥202",
    period: "/ 季",
    baseCredits: "720 积分",
    campaignCredits: "840 积分",
    firstPurchaseBonus: "含首购赠送 120",
    description: "季度额度，适合固定上新节奏。",
    features: [
      "画板编辑、详情页、风格复刻持续可用",
      "支持 1K / 2K / 4K 生成配置",
      "比月付更适合连续产出",
      "到期后可手动续购",
    ],
    paymentNote: "Paddle Checkout",
  },
  {
    id: "yearly-subscription",
    billingType: "subscription",
    eyebrow: "SUBSCRIPTION",
    name: "最高优惠",
    badge: "超值",
    originalPrice: "¥1436",
    currentPrice: "¥718",
    period: "/ 年",
    baseCredits: "3,000 积分",
    campaignCredits: "3,500 积分",
    firstPurchaseBonus: "含首购赠送 500",
    description: "全年素材预算，适合长期运营。",
    features: [
      "主图 2.0、详情页 16 模块、画板编辑",
      "风格复刻、服装试穿",
      "最高性价比普通订阅",
      "到期后可手动续购",
    ],
    paymentNote: "Paddle Checkout",
  },
];

function PricingCard({
  plan,
  onSelect,
}: {
  plan: CreditPlan;
  onSelect: (plan: CreditPlan) => void;
}) {
  return (
    <article
      className={`price-card credit-plan-card${
        plan.badge ? " is-recommended" : ""
      }`}
    >
      <div className="plan-card-topline">
        <p className="card-meta">{plan.eyebrow}</p>
        {plan.badge ? <p className="plan-badge">{plan.badge}</p> : null}
      </div>
      <h2>{plan.name}</h2>
      <p className="plan-description">{plan.description}</p>
      <div className="plan-price-row">
        <span className="original-price">{plan.originalPrice}</span>
        <span className="discount-badge">5 折</span>
      </div>
      <p className="price-value">
        {plan.currentPrice}
        {plan.period ? <span>{plan.period}</span> : null}
      </p>
      <div className="credit-stack">
        <strong>{plan.baseCredits}</strong>
        {plan.campaignCredits ? (
          <p>
            <span>首购合计</span>
            {plan.campaignCredits}
          </p>
        ) : null}
      </div>
      <div className="bonus-stack">
        <span>{plan.firstPurchaseBonus}</span>
        {plan.cumulativeBonus ? <span>{plan.cumulativeBonus}</span> : null}
      </div>
      <ul className="feature-list">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <button
        type="button"
        className="primary-button plan-pay-button"
        onClick={() => onSelect(plan)}
      >
        支付
      </button>
      <p className="plan-payment-note">
        {plan.paymentNote ?? "单次购买，积分永不过期"}
      </p>
    </article>
  );
}

export function PricingPage() {
  const [activeBilling, setActiveBilling] = useState<BillingType>("top-up");
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");

  const activePlans =
    activeBilling === "top-up" ? topUpPlans : subscriptionPlans;
  const activePlanMeta =
    activeBilling === "top-up"
      ? {
          description: "灵活充值，积分永不过期。",
        }
      : {
          description: "按周期获得固定额度，到期后可手动续购。",
        };

  const handleSelectPlan = async (plan: CreditPlan) => {
    const creditAmount = parseCreditAmount(plan.campaignCredits ?? plan.baseCredits);
    const session = getAccountSnapshot().session;
    const usePaddle = isPaddleCheckoutConfigured();
    const missingPaddleConfig = getMissingPaddleCheckoutConfig(plan.id);

    if (usePaddle && !session?.userId) {
      setSelectedPlan(plan);
      setPaymentStatus("请先登录 kroma 账户，再购买积分。");
      return;
    }

    setSelectedPlan(plan);
    try {
      if (usePaddle) {
        if (missingPaddleConfig.length > 0) {
          setPaymentStatus(
            `支付套餐未配置完成：${missingPaddleConfig.join("、")}。`,
          );
          return;
        }

        const backendHealth = await getWebBackendHealth();

        if (!isPaymentFulfillmentReady(backendHealth)) {
          setPaymentStatus("支付入账暂未配置完成，请稍后再试或联系支持。");
          return;
        }
      }

      const result = await purchasePlan({
        credits: creditAmount,
        planId: plan.id,
        planName: plan.name,
        paymentChannel: usePaddle ? "paddle" : "mock",
        note: usePaddle ? "Paddle checkout pending." : "订单已确认，积分已入账。",
        userId: session?.userId,
        email: session?.identifier,
      });

      const snapshot = result.account;

      if (result.status === "pending") {
        setPaymentStatus(
          `已打开 ${plan.name} 支付窗口，付款成功后积分会自动入账。`,
        );
        return;
      }

      setPaymentStatus(
        `已确认 ${plan.name}，${formatCredits(
          result.creditedAmount,
        )} 积分已入账，当前余额 ${formatCredits(snapshot.balance)} 积分。`,
      );
    } catch (error) {
      setPaymentStatus(
        error instanceof Error
          ? error.message
          : "支付通道暂时不可用，请稍后再试。",
      );
    }
  };

  return (
    <main className="pricing-page page-surface">
      <section className="pricing-intro panel">
        <div className="panel-heading">
          <p className="eyebrow">Plan Settings</p>
          <h2>按你的电商创作节奏选择套餐</h2>
          <p>积分按实际生成消耗，失败任务不计入消耗。</p>
        </div>
        {selectedPlan ? (
          <p className="pricing-payment-status" role="status">
            {paymentStatus}
          </p>
        ) : null}
      </section>

      <section className="pricing-section" aria-label="套餐列表">
        <div className="pricing-section-heading">
          <div className="pricing-plan-switch" aria-label="套餐类型">
            <button
              type="button"
              className={activeBilling === "top-up" ? "is-active" : ""}
              aria-pressed={activeBilling === "top-up"}
              onClick={() => setActiveBilling("top-up")}
            >
              一次性购买
            </button>
            <button
              type="button"
              className={activeBilling === "subscription" ? "is-active" : ""}
              aria-pressed={activeBilling === "subscription"}
              onClick={() => setActiveBilling("subscription")}
            >
              订阅方案
            </button>
          </div>
          <p>{activePlanMeta.description}</p>
        </div>
        <div className="pricing-grid credit-plan-grid">
          {activePlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />
          ))}
        </div>
      </section>
    </main>
  );
}
