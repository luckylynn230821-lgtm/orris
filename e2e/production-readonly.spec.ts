import { expect, test } from "@playwright/test";

test("production lookup ignores a matching email and accepts the checkout token", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.getByText("An email address alone is not enough.")).toBeVisible();

const outcome = await page.evaluate(async () => {
    const href = [...document.querySelectorAll("script,link")]
      .map((node) => node.getAttribute("src") || node.getAttribute("href") || "")
      .find((value) => value.includes("/assets/fns-"));
    if (!href) throw new Error("production functions bundle was not found");
    const mod = (await import(href)) as {
      z: (input: { data: Record<string, string> }) => Promise<{ number?: string; stageKey?: string } | null>;
    };
    const lookup = mod.z;
    const byEmail = await lookup({
      data: { number: "OR-18421", email: "j.ellis@example.com" },
    });
    const byWrongToken = await lookup({
      data: { number: "OR-18421", token: "seed-token-999" },
    });
    const byMismatched = await lookup({
      data: { number: "OR-18422", token: "seed-token-1" },
    });
    const byToken = await lookup({
      data: { number: "OR-18421", token: "seed-token-1" },
    });
    return {
      byEmail: byEmail?.number ?? null,
      byWrongToken: byWrongToken?.number ?? null,
      byMismatched: byMismatched?.number ?? null,
      byToken: byToken?.number ?? null,
      stageKey: byToken?.stageKey ?? null,
    };
  });

  expect(outcome.byEmail).toBeNull();
  expect(outcome.byWrongToken).toBeNull();
  expect(outcome.byMismatched).toBeNull();
  expect(outcome.byToken).toBe("OR-18421");
  expect(outcome.stageKey).toBeTruthy();
});

test("production storefront copy does not include demonstration sales in the ranking note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Test template, not an official shop.")).toBeVisible();
  await expect(page.getByText("including earlier demonstration orders")).toHaveCount(0);
});
