// Playwright smoke test: verifies the app loads and the root heading is visible.
// Real interaction tests (webcam permission, audio start, summon flow) will be
// added here as features are implemented.
import { test, expect } from "@playwright/test";

test("app loads and shows the Ghost Theremin heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ghost Theremin/i })).toBeVisible();
});
