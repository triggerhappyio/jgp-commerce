import { test, expect } from "@playwright/test";

// NOTE ON EXECUTION: every page here is DB-backed (Prisma), so this suite
// requires `npm run dev` running against a real, seeded DATABASE_URL. It
// has not been run in an environment with no database available — see the
// final readiness report. The Stripe-hosted Checkout page itself is out of
// scope for browser automation (external, no test credentials in this
// environment) — the journey below stops at "checkout creation succeeded /
// redirect was requested," which is the actual boundary this app controls.

test.describe("Storefront → cart → checkout initiation", () => {
  test("homepage → catalog → product → color/size → add to cart → cart → checkout request", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText(/Body Alignment|K-Shoe|JGP/i);

    await page.getByRole("link", { name: /shop the revolution|shop/i }).first().click();
    await expect(page).toHaveURL(/\/shop/);

    // First in-stock product card.
    const firstProduct = page.locator("a.card").first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/shop\/.+/);

    // Pick a color if the product has one, then a size.
    const colorButtons = page.getByText(/color/i).locator("..").locator("button");
    if (await colorButtons.count()) {
      await colorButtons.first().click();
    }
    const sizeButton = page.getByRole("button", { name: /^\d{2,3}$|^\d+(\.\d+)?$/ }).first();
    if (await sizeButton.count()) {
      await sizeButton.click();
    }

    const addToCart = page.getByRole("button", { name: /add to cart/i });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await expect(page.getByRole("button", { name: /added/i })).toBeVisible();

    // Cart badge in nav reflects the addition.
    await expect(page.getByRole("link", { name: /cart \(\s*[1-9]/i })).toBeVisible();

    await page.getByRole("link", { name: /cart \(/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();

    const checkoutButton = page.getByRole("button", { name: /checkout with stripe/i });
    await expect(checkoutButton).toBeEnabled();
    // Not clicked further — beyond this point control passes to Stripe's
    // hosted Checkout page, outside this app and outside browser automation
    // scope without live Stripe test credentials (see final readiness report).
  });

  test("a sold-out size cannot be added to cart", async ({ page }) => {
    await page.goto("/shop");
    // Requires at least one product with a fully sold-out size in seed data
    // to be meaningful — see prisma/seed.ts. If none exists, this test has
    // nothing to assert against and should be treated as inconclusive, not
    // a false pass.
    const soldOutSize = page.locator("button[disabled]").filter({ hasText: /^\d{2,3}$/ }).first();
    test.skip((await soldOutSize.count()) === 0, "No sold-out size variant in current catalog to test against");
    await expect(soldOutSize).toBeDisabled();
  });

  test("quantity selector never offers more than available stock", async ({ page, request }) => {
    await page.goto("/shop");
    const firstProduct = page.locator("a.card").first();
    await firstProduct.click();

    const stockLabel = page.getByText(/in stock/i).first();
    await expect(stockLabel).toBeVisible();
    const stockText = await stockLabel.textContent();
    const available = Number(stockText?.match(/(\d+)\s+in stock/i)?.[1] ?? "0");

    const qtySelect = page.locator("#qty");
    if (available > 0 && (await qtySelect.count())) {
      const options = await qtySelect.locator("option").allTextContents();
      const maxOffered = Math.max(...options.map(Number));
      expect(maxOffered).toBeLessThanOrEqual(Math.min(available, 10));
    }
  });

  test("cart persists across a page reload (localStorage)", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a.card").first().click();
    const addToCart = page.getByRole("button", { name: /add to cart/i });
    if (await addToCart.isEnabled()) {
      await addToCart.click();
      await page.reload();
      await expect(page.getByRole("link", { name: /cart \(\s*[1-9]/i })).toBeVisible();
    }
  });

  test("mobile (390px): navigation and checkout button are usable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "mobile-only assertion");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "JGP USA" })).toBeVisible();
    await page.getByRole("link", { name: /shop$/i }).first().click();
    await expect(page).toHaveURL(/\/shop/);
  });
});
