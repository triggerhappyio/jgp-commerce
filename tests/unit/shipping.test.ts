import { describe, it, expect } from "vitest";
import { calculateShipping, type ShippingConfig } from "@/lib/shipping";

const baseConfig: ShippingConfig = {
  enabled: true,
  standardAmountCents: 800,
  freeThresholdCents: 15000,
  currency: "usd"
};

describe("calculateShipping (server-authoritative, no floating point)", () => {
  it("charges the standard rate below the free-shipping threshold", () => {
    const quote = calculateShipping(5000, baseConfig);
    expect(quote.amountCents).toBe(800);
    expect(Number.isInteger(quote.amountCents)).toBe(true);
  });

  it("is free exactly at the threshold", () => {
    const quote = calculateShipping(15000, baseConfig);
    expect(quote.amountCents).toBe(0);
    expect(quote.label).toBe("Free Shipping");
  });

  it("is free above the threshold", () => {
    const quote = calculateShipping(50000, baseConfig);
    expect(quote.amountCents).toBe(0);
  });

  it("charges nothing when shipping is disabled", () => {
    const quote = calculateShipping(100, { ...baseConfig, enabled: false });
    expect(quote.amountCents).toBe(0);
  });

  it("has no free threshold when explicitly null", () => {
    const quote = calculateShipping(1_000_000, { ...baseConfig, freeThresholdCents: null });
    expect(quote.amountCents).toBe(800);
  });

  it("never returns a fractional cent amount", () => {
    // Guards against a future edit reintroducing floating-point math —
    // all amounts here must stay integer minor units.
    for (const subtotal of [0, 1, 799, 800, 14999, 15000, 15001]) {
      const quote = calculateShipping(subtotal, baseConfig);
      expect(Number.isInteger(quote.amountCents)).toBe(true);
    }
  });
});
