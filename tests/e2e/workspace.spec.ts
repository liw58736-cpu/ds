import { expect, test, type Page } from "@playwright/test";

async function loadSampleProduct(page: Page) {
  await page.addInitScript(() => {
    const session = {
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-20T00:00:00.000Z",
    };
    localStorage.setItem(
      "commerce-studio-account-v1",
      JSON.stringify({
        balance: 5,
        session,
        transactions: [],
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "商品主图", exact: true }).click();
  const uploadRegion = page.getByRole("region", { name: "产品素材" });
  await expect(uploadRegion).toBeVisible();
  await uploadRegion
    .getByRole("button", { name: "使用示例商品", exact: true })
    .click();
  await expect(page.getByAltText("当前商品图")).toBeVisible();
}

async function generateSampleAsset(page: Page) {
  await page.locator(".version-grid button").first().click();
  await page.getByRole("button", { name: "4K", exact: true }).click();
  await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
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

async function seedAuthenticatedAccount(page: Page, balance = 100) {
  await page.addInitScript((accountBalance) => {
    const session = {
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-20T00:00:00.000Z",
    };
    localStorage.setItem(
      "commerce-studio-account-v1",
      JSON.stringify({
        balance: accountBalance,
        session,
        transactions: [],
      }),
    );
  }, balance);
}

async function openStudioPage(page: Page, navIndex: number) {
  await page.goto("/");
  await page.locator(".topnav-button").nth(navIndex).click();
  await expect(page.locator(".workspace-route")).toBeVisible();
}

async function useSampleProductByCss(page: Page) {
  await page.locator(".upload-actions .secondary-button").click();
  await expect(page.locator(".current-product img")).toBeVisible();
}

async function chooseStandardOneK(page: Page) {
  await page.locator(".version-grid button").first().click();
  await page.getByRole("button", { name: "1K", exact: true }).click();
}

async function generateAndExpectResults(page: Page, count: number) {
  await page.locator(".generate-button").click();
  await expect(page.locator(".preview-result-item img")).toHaveCount(count);
  await expect(page.locator(".preview-result-item .ghost-action-button")).toHaveCount(count);
}

test("sample product generates a mock ecommerce image", async ({ page }) => {
  await loadSampleProduct(page);
  await generateSampleAsset(page);

  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expect(page.getByText("已生成")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "最近任务" })).toHaveCount(0);
});

test("main image multi-select creates one result per selected function and records the function", async ({
  page,
}) => {
  await seedAuthenticatedAccount(page);
  await openStudioPage(page, 1);
  await useSampleProductByCss(page);
  await chooseStandardOneK(page);

  await page.locator(".module-card-button").nth(0).click();
  await page.locator(".module-card-button").nth(1).click();
  await expect(page.locator(".generation-footer")).toContainText("2");

  await generateAndExpectResults(page, 2);

  await page.locator(".topnav-button").nth(4).click();
  await expect(page.locator(".history-task-row")).toHaveCount(1);
  await expect(page.locator(".history-task-row strong")).toContainText("/");
  await expect(page.locator(".history-task-row strong")).toContainText("KV");
});

test("detail page quantity controls create multiple results for the same module", async ({
  page,
}) => {
  await seedAuthenticatedAccount(page);
  await openStudioPage(page, 2);
  await useSampleProductByCss(page);
  await chooseStandardOneK(page);

  const firstDetailModule = page.locator(".detail-module-button").first();
  await firstDetailModule.click();
  await firstDetailModule.locator(".detail-module-stepper button").last().click();
  await expect(firstDetailModule.locator(".detail-module-stepper b")).toHaveText("2");
  await expect(page.locator(".generation-footer")).toContainText("2");

  await generateAndExpectResults(page, 2);
});

test("AI tool modes all connect to generation and return a downloadable result", async ({
  page,
}) => {
  await seedAuthenticatedAccount(page, 100);
  await openStudioPage(page, 3);
  await useSampleProductByCss(page);
  await chooseStandardOneK(page);

  const toolButtons = page.locator(".segmented-control").first().getByRole("button");
  const toolCount = await toolButtons.count();
  expect(toolCount).toBe(6);

  for (let index = 0; index < toolCount; index += 1) {
    await toolButtons.nth(index).click();
    await generateAndExpectResults(page, 1);
  }
});

test("preview canvas uses an opaque surface behind generated results", async ({
  page,
}) => {
  await loadSampleProduct(page);
  await generateSampleAsset(page);

  await expect(page.getByAltText("生成结果")).toBeVisible();

  const previewBackground = await page.locator(".preview-grid").evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });

  expect(previewBackground.backgroundImage).toBe("none");
  expect(previewBackground.backgroundColor).toBe("rgb(255, 255, 255)");
});

test("mobile workspace avoids horizontal document overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile chromium",
    "Mobile viewport coverage belongs to the mobile Chromium project.",
  );

  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("button", { name: "首页", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "AI 商品图，一键生成可上架素材",
    }),
  ).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);

  await loadSampleProduct(page);
  await generateSampleAsset(page);
  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);
});

test("navigation surfaces render and preserve generated history", async ({
  page,
}) => {
  await loadSampleProduct(page);
  await generateSampleAsset(page);

  await page.getByRole("button", { name: "价格" }).click();
  await expect(
    page.getByRole("heading", { name: "按你的电商创作节奏选择套餐", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "一次性购买" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const payButtons = page.getByRole("button", { name: "支付" });
  await expect(payButtons).toHaveCount(3);
  await payButtons.nth(2).click();
  await expect(page.getByRole("status")).toContainText(
    "已确认 专业包，950 积分已入账，当前余额 951 积分。",
  );
  await page.getByRole("button", { name: "订阅方案" }).click();
  await expect(page.getByRole("button", { name: "订阅方案" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "一次性购买", level: 2 }),
  ).toHaveCount(0);
  await expect(payButtons).toHaveCount(3);
  await expectNoHorizontalDocumentOverflow(page);

  await page.getByRole("button", { name: "账户" }).click();
  await expect(
    page.getByRole("heading", { name: "账户与用量", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("951 credits")).toBeVisible();
  await expect(page.getByText("购买 专业包")).toHaveCount(0);

  await expect(page.locator(".topnav-button")).toHaveCount(7);
  await expect(page.locator(".account-email")).toBeVisible();
  await expect(page.locator(".account-logout-button")).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);

  await page.getByRole("button", { name: "历史任务" }).click();
  await expect(
    page.getByRole("heading", { name: "历史任务", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "历史任务统计" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "最近任务", level: 2 }),
  ).toBeVisible();
  await expect(page.getByAltText("当前商品图")).toHaveCount(0);
  await expect(page.getByAltText("生成结果")).toHaveCount(0);
  await expect(
    page.locator(".history-task-list").getByText("已完成"),
  ).toBeVisible();
});

test("footer legal pages render", async ({ page }) => {
  await page.goto("/");

  const pages = [
    { button: "服务条款", title: "服务条款", text: "积分、套餐与支付" },
    { button: "隐私政策", title: "隐私政策", text: "图片与生成内容" },
    { button: "退款政策", title: "退款政策", text: "活动与赠送积分" },
    { button: "积分说明", title: "积分消耗说明", text: "扣减规则" },
    { button: "联系支持", title: "联系支持", text: "liw58736@gmail.com" },
    { button: "关于我们", title: "关于我们", text: "产品原则" },
  ];

  await expect(page.getByRole("button", { name: "企业采购" })).toHaveCount(0);

  for (const item of pages) {
    await page.getByRole("button", { name: item.button }).click();
    await expect(
      page.getByRole("heading", { name: item.title, level: 1 }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(0);
    await expect(page.getByText(item.text)).toBeVisible();
    await expectNoHorizontalDocumentOverflow(page);
  }
});
