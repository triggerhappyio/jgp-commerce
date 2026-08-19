// TaxService — the one place Stripe Tax configuration is decided. Nothing
// outside this file should reference STRIPE_AUTOMATIC_TAX_ENABLED or know
// how tax gets turned on; if the provider ever changes, only this file
// (and the shape passed into Stripe.checkout.sessions.create) should need
// to move.
//
// FAILS SAFE: tax calculation defaults OFF. Turning it on requires an
// explicit env var, because turning it on without Stripe Tax actually being
// activated + registered for the right jurisdictions in the Stripe
// Dashboard would silently undercharge (or wrongly charge) customers tax —
// see docs/TAX_SETUP.md for the Dashboard steps this depends on. This file
// has no way to verify that Dashboard state itself; it only ever reflects
// what the operator has confirmed via the env var.
export type TaxConfig = {
  enabled: boolean;
};

export function getTaxConfig(): TaxConfig {
  return {
    enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"
  };
}

// Stripe Checkout's automatic_tax option, ready to spread into
// stripe.checkout.sessions.create(...). Requires shipping_address_collection
// to already be set on the session (it is — see app/api/checkout/route.ts) —
// Stripe computes tax from the address the customer enters at checkout.
export function automaticTaxParam(): { enabled: boolean } {
  return { enabled: getTaxConfig().enabled };
}
