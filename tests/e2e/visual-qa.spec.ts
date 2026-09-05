import { expect, test } from "@playwright/test";

test("all signed-in pages remain aligned at desktop and phone widths", async ({ page }, info) => {
  test.setTimeout(60000);
  const mobile = info.project.name.includes("mobile");
  if (!mobile) await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem("commerce-studio-account-v1", JSON.stringify({
      balance: 5, transactions: [], session: { identifier: "visual@example.com", authView: "login", mode: "password", storeName: "", inviteCode: "", createdAt: "2026-09-05T00:00:00Z" },
    }));
  });
  for (const route of ["home", "main_image", "detail_page", "white_background", "inspiration", "motion", "materials", "history", "pricing", "account"]) {
    await page.goto(route === "home" ? "/" : `/#/${route}`);
    await expect(page.locator("main:visible").first()).toBeVisible();
    const bounds = await page.evaluate(() => {
      const bar = document.querySelector(".topbar")!.getBoundingClientRect();
      const main = [...document.querySelectorAll("main")].find(el => el.getBoundingClientRect().width > 0)!.getBoundingClientRect();
      return { left: bar.left, right: bar.right, mainLeft: main.left, mainRight: main.right, doc: document.documentElement.scrollWidth, width: document.documentElement.clientWidth };
    });
    expect(bounds.doc, route).toBeLessThanOrEqual(bounds.width + 1);
    if (mobile) {
      const firstNav = await page.locator(".topnav-button").first().boundingBox();
      expect(firstNav!.width).toBeLessThan(130);
    }
    if (route !== "account") {
      expect(Math.abs(bounds.left - bounds.mainLeft), route).toBeLessThan(2);
      expect(Math.abs(bounds.right - bounds.mainRight), route).toBeLessThan(2);
    }
    if (["home", "main_image", "materials", "pricing"].includes(route)) {
      await page.screenshot({ path: `output/qa-2026-09-05/ui-${mobile ? "mobile" : "desktop"}-${route}.png`, fullPage: true });
    }
  }
});

test("login and recovery stay centered and recovery actions align", async ({ page }, info) => {
  if (!info.project.name.includes("mobile")) await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/login");
  const password = page.getByLabel("密码", { exact: true });
  const forgot = page.getByRole("button", { name: "忘记密码？", exact: true });
  await expect(password).toBeVisible();
  const p = await password.boundingBox(), b = await forgot.boundingBox();
  expect(Math.abs(p!.x + p!.width - b!.x - b!.width)).toBeLessThan(2);
  await forgot.click();
  const card = await page.locator(".password-reset-card").boundingBox();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(Math.abs(card!.x + card!.width / 2 - width / 2)).toBeLessThan(2);
  await expect(page.getByRole("button", { name: "发送找回验证码" })).toBeVisible();
});

test("public homepage keeps its content in view", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI 商品图，一键生成可上架素材" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `output/qa-2026-09-05/ui-${info.project.name.includes("mobile") ? "mobile" : "desktop"}-public-home.png`, fullPage: true });
});
