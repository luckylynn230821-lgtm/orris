import { expect, test } from "@playwright/test";

test("production lookup ignores a matching email and rejects the retired seed token", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.getByText("An email address alone is not enough.")).toBeVisible();

  const outcome = await page.evaluate(async () => {
    const href = [...document.querySelectorAll("script,link")]
      .map((node) => node.getAttribute("src") || node.getAttribute("href") || "")
      .find((value) => value.includes("/assets/fns-"));
    if (!href) throw new Error("production functions bundle was not found");
    const mod = (await import(href)) as {
      z: (input: { data: Record<string, string> }) => Promise<{ number?: string } | null>;
    };
    const lookup = mod.z;
    const byEmail = await lookup({
      data: { number: "OR-18421", email: "j.ellis@example.com" },
    });
    const byRetired = await lookup({
      data: { number: "OR-18421", token: "seed-token-1" },
    });
    const byOtherRetired = await lookup({
      data: { number: "OR-18422", token: "seed-token-1" },
    });
    return {
      byEmail: byEmail?.number ?? null,
      byRetired: byRetired?.number ?? null,
      byOtherRetired: byOtherRetired?.number ?? null,
    };
  });

  expect(outcome.byEmail).toBeNull();
  expect(outcome.byRetired).toBeNull();
  expect(outcome.byOtherRetired).toBeNull();
});

test("production storefront copy does not include demonstration sales in the ranking note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Test template, not an official shop.")).toBeVisible();
  await expect(page.getByText("including earlier demonstration orders")).toHaveCount(0);
});
