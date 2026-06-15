import { expect, test } from "@playwright/test";

test("renders the Commerce Studio heading", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Commerce Studio" }),
  ).toBeVisible();
});
