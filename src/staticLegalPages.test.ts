import { describe, expect, it } from "vitest";
import homepageHtml from "../index.html?raw";
import aboutHtml from "../public/about/index.html?raw";
import aboutDirectHtml from "../public/about.html?raw";
import creditsHtml from "../public/credits/index.html?raw";
import creditsDirectHtml from "../public/credits.html?raw";
import privacyHtml from "../public/privacy/index.html?raw";
import privacyDirectHtml from "../public/privacy.html?raw";
import pricingHtml from "../public/pricing/index.html?raw";
import pricingDirectHtml from "../public/pricing.html?raw";
import refundHtml from "../public/refund/index.html?raw";
import refundDirectHtml from "../public/refund.html?raw";
import robotsTxt from "../public/robots.txt?raw";
import sitemapXml from "../public/sitemap.xml?raw";
import termsHtml from "../public/terms/index.html?raw";
import termsDirectHtml from "../public/terms.html?raw";

describe("static legal pages", () => {
  it("exposes direct legal links in the raw homepage HTML for payment review crawlers", () => {
    expect(homepageHtml).toContain('href="/terms.html"');
    expect(homepageHtml).toContain('href="/privacy.html"');
    expect(homepageHtml).toContain('href="/refund.html"');
    expect(homepageHtml).toContain('href="/pricing.html"');
    expect(homepageHtml).toContain('href="/about.html"');
    expect(homepageHtml).toContain('href="/credits.html"');
    expect(homepageHtml).toContain('href="/support.html"');
    expect(homepageHtml).toContain("Terms of Service");
    expect(homepageHtml).toContain("Privacy Policy");
    expect(homepageHtml).toContain("Refund Policy");
    expect(homepageHtml).toContain("Pricing");
    expect(homepageHtml).toContain("AI ecommerce image generation");
  });

  it("publishes crawlable static pages on directory and direct html paths", () => {
    const pages = [
      {
        html: termsHtml,
        title: "Terms of Service",
      },
      {
        html: termsDirectHtml,
        title: "Terms of Service",
      },
      {
        html: termsHtml,
        title: "Seller Identity",
      },
      {
        html: privacyHtml,
        title: "Privacy Policy",
      },
      {
        html: privacyDirectHtml,
        title: "Privacy Policy",
      },
      {
        html: refundHtml,
        title: "Refund Policy",
      },
      {
        html: refundDirectHtml,
        title: "Refund Policy",
      },
      {
        html: pricingHtml,
        title: "Pricing",
      },
      {
        html: pricingDirectHtml,
        title: "Pricing",
      },
      {
        html: creditsHtml,
        title: "Credit Policy",
      },
      {
        html: creditsDirectHtml,
        title: "Credit Policy",
      },
      {
        html: aboutHtml,
        title: "About kroma",
      },
      {
        html: aboutDirectHtml,
        title: "About kroma",
      },
    ];

    pages.forEach((page) => {
      expect(page.html).toContain(page.title);
      expect(page.html).toContain('href="/terms.html"');
      expect(page.html).toContain('href="/privacy.html"');
      expect(page.html).toContain('href="/refund.html"');
      expect(page.html).toContain('href="/pricing.html"');
      expect(page.html).toContain("liw58736@gmail.com");
    });
  });

  it("publishes a crawlable pricing page for payment-domain review", () => {
    [pricingHtml, pricingDirectHtml].forEach((html) => {
      expect(html).toContain("kroma Pricing");
      expect(html).toContain("One-time credit packs");
      expect(html).toContain("Subscription plans");
      expect(html).toContain("¥36");
      expect(html).toContain("100 credits");
      expect(html).toContain("Paddle Checkout");
      expect(html).toContain("Credits are delivered to the user's kroma account");
      expect(html).toContain("Failed generation tasks do not consume credits");
      expect(html).toContain('href="/terms.html"');
      expect(html).toContain('href="/privacy.html"');
      expect(html).toContain('href="/refund.html"');
    });
  });

  it("publishes crawler discovery files for review pages", () => {
    expect(robotsTxt).toContain("Sitemap: https://kromaai.app/sitemap.xml");
    [
      "https://kromaai.app/",
      "https://kromaai.app/pricing.html",
      "https://kromaai.app/about.html",
      "https://kromaai.app/credits.html",
      "https://kromaai.app/terms.html",
      "https://kromaai.app/privacy.html",
      "https://kromaai.app/refund.html",
      "https://kromaai.app/support.html",
    ].forEach((url) => {
      expect(sitemapXml).toContain(url);
    });
  });
});
