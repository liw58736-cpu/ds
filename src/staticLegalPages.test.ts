import { describe, expect, it } from "vitest";
import homepageHtml from "../index.html?raw";
import aboutHtml from "../public/about/index.html?raw";
import aboutDirectHtml from "../public/about.html?raw";
import creditsHtml from "../public/credits/index.html?raw";
import creditsDirectHtml from "../public/credits.html?raw";
import privacyHtml from "../public/privacy/index.html?raw";
import privacyDirectHtml from "../public/privacy.html?raw";
import refundHtml from "../public/refund/index.html?raw";
import refundDirectHtml from "../public/refund.html?raw";
import termsHtml from "../public/terms/index.html?raw";
import termsDirectHtml from "../public/terms.html?raw";

describe("static legal pages", () => {
  it("exposes direct legal links in the raw homepage HTML for payment review crawlers", () => {
    expect(homepageHtml).toContain('href="/terms.html"');
    expect(homepageHtml).toContain('href="/privacy.html"');
    expect(homepageHtml).toContain('href="/refund.html"');
    expect(homepageHtml).toContain('href="/support.html"');
    expect(homepageHtml).toContain("Terms of Service");
    expect(homepageHtml).toContain("Privacy Policy");
    expect(homepageHtml).toContain("Refund Policy");
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
      expect(page.html).toContain("liw58736@gmail.com");
    });
  });
});
