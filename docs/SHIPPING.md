# Shipping — V1

## What exists today

`lib/shipping.ts` is the single source of truth for shipping pricing. No
carrier integration exists yet — V1 is a flat rate with a free-shipping
threshold, both server-configured:

```ts
SHIPPING_ENABLED=true                    # default true
SHIPPING_STANDARD_AMOUNT_CENTS=800       # default $8.00 — JGP should set the real number
SHIPPING_FREE_THRESHOLD_CENTS=15000      # default $150.00 — set null-equivalent by omitting to disable free shipping
```

**These defaults are placeholders, not JGP's actual shipping policy** — set
real values in the environment before launch. `calculateShipping()` is a
pure function (no Stripe/DB dependency), so the actual pricing logic is
unit-testable in isolation.

The server computes the shipping amount from the server-computed
reservation subtotal (never a client-submitted number) and passes it to
Stripe as `shipping_options` on the Checkout Session — Stripe displays and
charges exactly that amount; the browser never calculates or submits a
shipping price. The finalized amount is read back from
`session.total_details.amount_shipping` in the webhook and stored on
`Order.shippingCents`.

## Address handling

`shipping_address_collection: { allowed_countries: ["US"] }` is already set
on every Checkout Session (domestic-only for V1). The finalized address
Stripe collects is stored as a **snapshot** on `Order.shippingAddress`
(`Json`) at the moment the order is created — this is intentionally not a
live foreign key to a `Customer`/`Address` record, so a customer editing or
deleting a saved address later never changes what a past order says it
shipped to.

## Adding a real carrier later (Shippo / EasyPost / UPS / FedEx / USPS)

Nothing here is built yet, and nothing fake has been built in its place —
no mock tracking numbers, no invented carrier API calls. When a provider is
selected:

1. Add a `ShippingProvider` interface (e.g. `lib/shipping-provider.ts`)
   with `getRates(address, items)` and `createLabel(order)` methods.
2. `calculateShipping()` in `lib/shipping.ts` becomes the "no live rates
   configured" fallback rather than the only path — real rate shopping
   would call `getRates()` instead when a provider is configured.
3. Label creation and tracking would plug into the existing
   `Shipment` model (`carrier`, `trackingNumber`, `trackingUrl`,
   `shippedAt`) — those fields already exist and are already wired into the
   admin fulfillment UI (`app/admin/(dashboard)/orders/[id]`), so adding a
   real provider is additive, not a rework of the order/fulfillment model.

## What's stored on the Order

| Field | Meaning |
|---|---|
| `shippingCents` | The finalized shipping charge Stripe actually collected |
| `shippingAddress` | Snapshot of the address at time of order — immutable afterward |

See `docs/TAX_SETUP.md` for the equivalent tax reconciliation fields.
