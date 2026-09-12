const { expect, test } = require("@playwright/test");

test("user completes the milestone 3 decision workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Build a plan/ })).toBeVisible();

  await page.getByRole("button", { name: /Choose a format for a fictional team workshop/ }).click();
  await expect(page.getByRole("status")).toContainText("Synthetic reference case imported");
  await expect(page.getByLabel("Study title")).toHaveValue(/workshop/i);

  await page.getByRole("button", { name: "Generate draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft generated", { timeout: 30_000 });
  await expect(page.locator(".run-strip")).toContainText("completed");

  await page.getByRole("button", { name: /Compare/ }).click();
  await expect(page.getByTestId("compare-panel")).toContainText("9/9 assessed");
  await expect(page.getByTestId("compare-panel")).toContainText("Status quo");

  await page.getByRole("button", { name: /Decision/ }).click();
  await expect(page.getByTestId("brief-panel").getByLabel("Decision recommendation")).toContainText("reversible next step");
  await expect(page.getByTestId("brief-panel")).toContainText("Robustness check");
  await expect(page.getByTestId("brief-panel")).toContainText("Failure conditions");

  await page.getByTestId("brief-panel").getByRole("button", { name: /assumptions/ }).click();
  const assumption = page.getByLabel("Assumption").first();
  await assumption.fill(`${await assumption.inputValue()} — validated with a small pilot`);
  await expect(page.locator(".change-banner")).toContainText("drivers onward");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("marked stale");
  await expect(page.locator(".run-strip")).toContainText("stale");

  await page.getByRole("button", { name: "Resume analysis" }).click();
  await expect(page.getByRole("status")).toContainText("Draft generated", { timeout: 30_000 });
  await expect(page.locator(".run-strip")).toContainText("completed");

  await page.getByRole("button", { name: /Decision/ }).click();
  await page.getByRole("button", { name: "Accept revision" }).click();
  await expect(page.getByRole("status")).toContainText("preserved in history");
  await expect(page.getByTestId("brief-panel")).toContainText("Reviewed decision brief");

  const markdown = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export Markdown" }).click();
  await expect((await markdown).suggestedFilename()).toMatch(/\.md$/);

  await page.reload();
  await expect(page.getByLabel("Study title")).toHaveValue(/workshop/i);
  await page.getByRole("button", { name: /Evidence/ }).click();
  await expect(page.getByLabel("Assumption").first()).toHaveValue(/validated with a small pilot/);
});
