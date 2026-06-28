import { describe, expect, it } from "vitest";
import homepageHtml from "../index.html?raw";
import privacyHtml from "../public/privacy/index.html?raw";
import refundHtml from "../public/refund/index.html?raw";
import termsHtml from "../public/terms/index.html?raw";

describe("static legal pages", () => {
  it("exposes legal links in the raw homepage HTML for payment review crawlers", () => {
    expect(homepageHtml).toContain('href="/terms/index.html"');
    expect(homepageHtml).toContain('href="/privacy/index.html"');
    expect(homepageHtml).toContain('href="/refund/index.html"');
    expect(homepageHtml).toContain("Terms of Service");
    expect(homepageHtml).toContain("Privacy Policy");
    expect(homepageHtml).toContain("Refund Policy");
  });

  it("publishes crawlable static terms, privacy, and refund pages", () => {
    const pages = [
      {
        html: termsHtml,
        title: "Terms of Service",
        content: "积分、套餐与支付",
      },
      {
        html: privacyHtml,
        title: "Privacy Policy",
        content: "图片与生成内容",
      },
      {
        html: refundHtml,
        title: "Refund Policy",
        content: "可申请处理的情况",
      },
    ];

    pages.forEach((page) => {
      expect(page.html).toContain(page.title);
      expect(page.html).toContain(page.content);
      expect(page.html).toContain('href="/terms/index.html"');
      expect(page.html).toContain('href="/privacy/index.html"');
      expect(page.html).toContain('href="/refund/index.html"');
      expect(page.html).toContain("liw58736@gmail.com");
    });
  });
});
