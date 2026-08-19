// ShippingService — centralizes V1 shipping pricing so it's never
// hardcoded inline in checkout logic or (worse) computed in the browser.
// The server is the only thing that decides the shipping amount; the
// browser never submits one.
//
// V1 is intentionally simple: one flat domestic rate, with a free-shipping
// threshold. No carrier integration yet (Shippo/EasyPost/UPS/FedEx/USPS) —
// see docs/SHIPPING.md for how a real provider slots in later without
// touching checkout.ts: everything downstream only ever calls
// calculateShipping() and reads back { amountCents, label }.
export type ShippingConfig = {
  enabled: boolean;
  standardAmountCents: number;
  freeThresholdCents: number | null;
  currency: string;
};

export function getShippingConfig(): ShippingConfig {
  const standardAmountCents = Number(process.env.SHIPPING_STANDARD_AMOUNT_CENTS ?? "800");
  const freeThresholdRaw = process.env.SHIPPING_FREE_THRESHOLD_CENTS;

  return {
    enabled: process.env.SHIPPING_ENABLED !== "false", // on by default — footwear can't ship for $0 by accident
    standardAmountCents: Number.isFinite(standardAmountCents) ? standardAmountCents : 800,
    freeThresholdCents: freeThresholdRaw ? Number(freeThresholdRaw) : 15000,
    currency: "usd"
  };
}

export type ShippingQuote = {
  amountCents: number;
  label: string;
};

// Pure function — the actual business decision, deliberately separate from
// anything Stripe-shaped so it can be unit tested without a network call
// or a database. subtotalCents must be the server-computed reservation
// subtotal, never a client-submitted number.
export function calculateShipping(subtotalCents: number, config: ShippingConfig = getShippingConfig()): ShippingQuote {
  if (!config.enabled) {
    return { amountCents: 0, label: "Shipping" };
  }
  if (config.freeThresholdCents != null && subtotalCents >= config.freeThresholdCents) {
    return { amountCents: 0, label: "Free Shipping" };
  }
  return { amountCents: config.standardAmountCents, label: "Standard Shipping" };
}

// Ready to spread into stripe.checkout.sessions.create({ shipping_options: [...] }).
export function shippingOptionsParam(subtotalCents: number) {
  const config = getShippingConfig();
  const quote = calculateShipping(subtotalCents, config);
  return [
    {
      shipping_rate_data: {
        type: "fixed_amount" as const,
        fixed_amount: { amount: quote.amountCents, currency: config.currency },
        display_name: quote.label,
        delivery_estimate: {
          minimum: { unit: "business_day" as const, value: 3 },
          maximum: { unit: "business_day" as const, value: 7 }
        }
      }
    }
  ];
}
