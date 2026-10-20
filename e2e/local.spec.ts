import { expect, test } from "@playwright/test";

test("lookup asks for a token and does not open an order from a typed email", async ({ page }) => {
  const ready = page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.ok());
  await page.goto("/orders");
  await ready;
  await expect(page.getByRole("heading", { name: "Find an order" })).toBeVisible();
  await expect(page.getByText("An email address alone is not enough.")).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  const number = page.getByRole("textbox", { name: "Order number" });
  const token = page.getByRole("textbox", { name: "Order token" });
  await number.fill("OR-18421");
  await token.fill("j.ellis@example.com");
  await expect(number).toHaveValue("OR-18421");
  await expect(token).toHaveValue("j.ellis@example.com");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("No order matches that number and token.")).toBeVisible();
  await expect(page).toHaveURL(/\/orders$/);
});

test("the storefront does not rank demonstration orders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Test template, not an official shop.")).toBeVisible();
  await expect(page.getByText("including earlier demonstration orders")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Often chosen" })).toHaveCount(0);
});
