import { useEffect, useState } from "react";
import { getWebBackendHealth } from "../api/accountApi";
import {
  getMissingPaddleCheckoutConfig,
  getVerifiedPriceCatalog,
  type VerifiedPricePlan,
  isPaddleCheckoutConfigured,
  purchasePlan,
} from "../api/billingApi";
import { getAccountSnapshot } from "../storage/accountStore";
import type { WebBackendHealth } from "../api/accountApi";
import { NoticeDialog } from "./NoticeDialog";

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
    baseCredits: "1,500 积分",
    firstPurchaseBonus: "按支付订单入账",
    description: "灵活充值，积分永不过期，适合少量主图和详情图试用。",
    features: [
      "单次充值权益",
      "按积分用量计费",
      "图片库统一管理与选图",
      "AI 换装、换模特与图片下载",
      "主图、详情页及 AI 工具",
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
    baseCredits: "5,250 积分",
    firstPurchaseBonus: "按支付订单入账",
    description: "主图、详情页和图片编辑都能稳定覆盖，适合固定上新。",
    features: [
      "单次充值权益",
      "图片库、主图与详情页创作",
      "多模块组图与批量下载",
      "商品主图 + 详情页组图",
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
    baseCredits: "10,500 积分",
    firstPurchaseBonus: "按支付订单入账",
    description: "适合稳定店铺素材周转，覆盖主图、详情页和风格复刻。",
    features: [
      "图片库与各项创作工具",
      "详情页 19 模块、商品主图",
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
    baseCredits: "3,550 积分",
    firstPurchaseBonus: "每期按支付订单入账",
    description: "每月固定积分，适合轻量持续创作。",
    features: [
      "持续创作权益",
      "按积分用量计费",
      "主图、详情页、换装、换模特可用",
      "主图、详情页及 AI 工具",
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
    baseCredits: "10,050 积分",
    firstPurchaseBonus: "每期按支付订单入账",
    description: "季度额度，适合固定上新节奏。",
    features: [
      "图片编辑、详情页、风格复刻持续可用",
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
    baseCredits: "36,000 积分",
    firstPurchaseBonus: "每期按支付订单入账",
    description: "全年素材预算，适合长期运营。",
    features: [
      "商品主图、详情页 19 模块、图片编辑",
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
  available = true,
}: {
  plan: CreditPlan;
  onSelect: (plan: CreditPlan) => void;
  available?: boolean;
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
      <div className="plan-price-row"></div>
      <p className="price-value">
        {available ? plan.currentPrice : "待核对"}
        {plan.period ? <span>{plan.period}</span> : null}
      </p>
      <div className="credit-stack">
        <strong>{available ? plan.baseCredits : "套餐积分核对中"}</strong>
        {available ? (
          <p>
            标准版 1K 约 {parseCreditAmount(plan.baseCredits).toLocaleString()}{" "}
            张 · 2K 约{" "}
            {Math.floor(
              parseCreditAmount(plan.baseCredits) / 2,
            ).toLocaleString()}{" "}
            张 · 4K 约{" "}
            {Math.floor(
              parseCreditAmount(plan.baseCredits) / 4,
            ).toLocaleString()}{" "}
            张
          </p>
        ) : null}

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
        disabled={!available}
        onClick={() => onSelect(plan)}
      >
        购买积分
      </button>
      <p className="plan-payment-note">
        {plan.paymentNote ?? "单次购买，积分永不过期"}
      </p>
    </article>
  );
}

interface PricingPageProps {
  onRequireLogin?: () => void;
}

export function PricingPage({ onRequireLogin }: PricingPageProps = {}) {
  const [verifiedPlans, setVerifiedPlans] = useState<VerifiedPricePlan[]>([]);
  const [catalogApproved, setCatalogApproved] = useState(!import.meta.env.PROD);
  useEffect(() => {
    if (import.meta.env.PROD)
      void getVerifiedPriceCatalog()
        .then((catalog) => {
          setCatalogApproved(catalog.approved);
          setVerifiedPlans(catalog.plans);
        })
        .catch(() => setCatalogApproved(false));
  }, []);
  const [activeBilling, setActiveBilling] = useState<BillingType>("top-up");
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");

  const showPaymentNotice = (message: string) => {
    setPaymentStatus(message);
    setPaymentNotice(message);
  };

  const activePlans = (
    activeBilling === "top-up" ? topUpPlans : subscriptionPlans
  ).map((plan) => {
    const verified = verifiedPlans.find((item) => item.id === plan.id);
    return verified
      ? {
          ...plan,
          baseCredits: `${verified.credits.toLocaleString()} 积分`,
          currentPrice: `¥${(verified.amount_minor / 100).toFixed(2)}`,
          paymentNote: verified.recurring
            ? "自动续费，可通过 Paddle 订单邮件管理或联系支持取消"
            : "单次购买，不自动续费",
          features: plan.features.map((feature) => feature === "到期后可手动续购"
            ? verified.recurring ? "按结账周期自动续费，可取消" : "到期后可手动续购"
            : feature),
        }
      : plan;
  });
  const activePlanMeta =
    activeBilling === "top-up"
      ? {
          description: "灵活充值，积分永不过期。",
        }
      : {
          description: "按周期获得积分，续费方式以套餐与结账页面为准。",
        };

  const handleSelectPlan = async (plan: CreditPlan) => {
    if (
      import.meta.env.PROD &&
      (!catalogApproved || !verifiedPlans.some((item) => item.id === plan.id))
    ) {
      showPaymentNotice("套餐正在核对，暂时无法购买。既有积分照常使用。");
      return;
    }
    const creditAmount = parseCreditAmount(
      plan.campaignCredits ?? plan.baseCredits,
    );
    const session = getAccountSnapshot().session;
    const usePaddle = isPaddleCheckoutConfigured();
    const missingPaddleConfig = getMissingPaddleCheckoutConfig(plan.id);

    if (usePaddle && !session?.userId) {
      setSelectedPlan(plan);
      showPaymentNotice("请先登录 kroma 账户，再购买积分。");
      return;
    }

    setSelectedPlan(plan);
    try {
      if (usePaddle) {
        if (missingPaddleConfig.length > 0) {
          showPaymentNotice(
            `支付套餐未配置完成：${missingPaddleConfig.join("、")}。`,
          );
          return;
        }

        const backendHealth = await getWebBackendHealth();

        if (!isPaymentFulfillmentReady(backendHealth)) {
          showPaymentNotice("支付入账暂未配置完成，请稍后再试或联系支持。");
          return;
        }
      }

      const result = await purchasePlan({
        credits: creditAmount,
        planId: plan.id,
        verifiedPriceId: verifiedPlans.find((item) => item.id === plan.id)
          ?.price_id,
        planName: plan.name,
        paymentChannel: usePaddle ? "paddle" : "mock",
        note: usePaddle
          ? "Paddle checkout pending."
          : "订单已确认，积分已入账。",
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
      showPaymentNotice(
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
          <p>
            1K 每张 1 积分 · 2K 每张 2 积分 · 4K 每张 4
            积分。品牌风格暂不额外收费。
          </p>
        </div>
        {selectedPlan ? (
          <p className="pricing-payment-status" role="status">
            {paymentStatus}
          </p>
        ) : null}
      </section>

      {!catalogApproved ? (
        <p className="pricing-payment-status">
          套餐价格与积分正在核对，暂时暂停新购买。既有积分和已购权益照常使用。
        </p>
      ) : null}
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
            <PricingCard
              key={plan.id}
              plan={plan}
              onSelect={handleSelectPlan}
              available={
                !import.meta.env.PROD ||
                (catalogApproved &&
                  verifiedPlans.some((item) => item.id === plan.id))
              }
            />
          ))}
        </div>
      </section>
      <NoticeDialog
        open={Boolean(paymentNotice)}
        title={paymentNotice.includes("登录") ? "请先登录" : "暂时无法支付"}
        message={paymentNotice}
        primaryLabel={paymentNotice.includes("登录") ? "去登录" : undefined}
        onPrimary={paymentNotice.includes("登录") ? onRequireLogin : undefined}
        onClose={() => setPaymentNotice("")}
      />
    </main>
  );
}
