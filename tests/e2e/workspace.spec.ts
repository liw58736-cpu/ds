import { expect, test, type Page } from "@playwright/test";

async function loadSampleProduct(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例商品" }).click();
  await expect(page.getByAltText("当前商品图")).toBeVisible();
}

async function generateSampleAsset(page: Page) {
  await page.getByLabel("平台").selectOption("shopify");
  await page.getByLabel("输出格式").selectOption("webp");
  await page.getByRole("button", { name: "生成素材" }).click();
}

async function expectNoHorizontalDocumentOverflow(page: Page) {
  const viewportWidths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewportWidths.scrollWidth).toBeLessThanOrEqual(
    viewportWidths.clientWidth + 1,
  );
}

test("sample product generates a mock ecommerce image", async ({ page }) => {
  await loadSampleProduct(page);
  await generateSampleAsset(page);

  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "最近任务" }).getByText("已完成"),
  ).toBeVisible();
});

test("mobile workspace avoids horizontal document overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile chromium",
    "Mobile viewport coverage belongs to the mobile Chromium project.",
  );

  await page.goto("/");
  await expect(page.getByRole("button", { name: "工作台" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "使用示例商品" }),
  ).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);

  await loadSampleProduct(page);
  await generateSampleAsset(page);
  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);
});

test("navigation surfaces render and preserve workspace history", async ({
  page,
}) => {
  await loadSampleProduct(page);
  await generateSampleAsset(page);

  await page.getByRole("button", { name: "模板库" }).click();
  await expect(
    page.getByRole("heading", { name: "模板库", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "价格" }).click();
  await expect(
    page.getByRole("heading", { name: "价格", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "账户" }).click();
  await expect(
    page.getByRole("heading", { name: "账户", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "历史任务" }).click();
  await expect(
    page.getByRole("heading", { name: "历史任务", level: 1 }),
  ).toBeVisible();
  await expect(page.getByAltText("当前商品图")).toBeVisible();
  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "最近任务" }).getByText("已完成"),
  ).toBeVisible();
});
