import CheckoutClient from "@/components/CheckoutClient";

// Server-side check (STRIPE_SECRET_KEY is a secret, never exposed to the
// client directly) so the cart page can show a polished, intentional
// "checkout not activated yet" state instead of an enabled button that
// leads to a 500 or a raw error message. See app/api/checkout/route.ts
// for the server-side enforcement of the same thing — this is a UX
// improvement on top of that, not a substitute for it.
export default function CheckoutPage() {
  const checkoutEnabled = !!process.env.STRIPE_SECRET_KEY;
  return <CheckoutClient checkoutEnabled={checkoutEnabled} />;
}
