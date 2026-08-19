# Returns & Exchanges — V1

## State machine

Uses the existing `ReturnStatus` enum (`REQUESTED → RECEIVED → INSPECTED →
RESTOCKED | REFUNDED | EXCHANGED`, or `REJECTED` from any non-terminal
state). This is a deliberate equivalent of a broader
`REQUESTED/AUTHORIZED/RECEIVED/INSPECTED/COMPLETED/REJECTED/CANCELLED`
model, collapsed to fit the schema that was already in place rather than
adding another schema migration this late: creating a `Return` at all
(via the admin "Start a Return" form on an order) *is* the authorization
step — a staff member is the only one who can create one — so there's no
separate unauthorized-request state to model. There's also no distinct
`CANCELLED` state; a return abandoned before completion and one a staff
member actively rejects both land on `REJECTED`, distinguished by the
`reason` text. If that distinction becomes operationally important, adding
`CANCELLED` to the enum is a small additive migration.

## Workflow (`lib/actions/returns.ts`)

```text
createReturn   → admin/orders/[id]: check items, quantities, optional
                 exchange-for variant. Validates: quantity <= purchased,
                 quantity <= remaining eligible (purchased minus
                 already-returned across every non-rejected Return for
                 that OrderItem — the same unit can never be returned twice).
markReceived   → REQUESTED -> RECEIVED
inspectItem    → per ReturnItem, staff records a condition. Once every
                 item on the Return has a condition, status auto-advances
                 to INSPECTED.
completeReturn → INSPECTED only. For each item: restocks (creates an
                 InventoryTransaction, type RETURN) only if condition is
                 "Sellable — restock"; damaged/defective items are never
                 restocked. Exchange lines commit the replacement variant
                 (decremented, type EXCHANGE) only if it's still in stock
                 at completion time — otherwise the whole completion fails
                 and the return stays INSPECTED for staff to reject or
                 hold. Non-exchange lines are refunded via the same
                 row-locked "remaining balance" pattern as
                 lib/actions/orders.ts refundOrder(), so a return and a
                 direct refund on the same order can never jointly
                 over-refund it.
rejectReturn   → any non-terminal state -> REJECTED. No inventory or
                 refund movement.
```

Every action independently re-verifies staff session/role
(`requireStaff()`), matching every other admin mutation in this codebase —
not just gated by the page it's rendered on.

## Why exchanges are same-price-only in V1

An unequal-price exchange (e.g. swapping into a different, more expensive
style) needs real settlement logic: charge the difference, or refund it,
tied correctly to the original payment intent, without creating a second
uncorrelated order or double-counting revenue. That's a legitimate feature
but a meaningfully different, riskier problem than "swap the physical
unit" — and faking automatic settlement for it would be worse than not
having it. `createReturn` enforces the same-price constraint at write time
(rejects the request with a clear message), not just in the UI — staff
should process a price-difference exchange as: this return (refund path,
no `exchangeFor` selected) + a brand new, separate checkout for the
replacement item.

## Known simplification: restock location

`OrderItem` doesn't carry which physical location fulfilled the original
sale, so restocked units land on whichever `InventoryLocation` has
`isDefault: true` (falling back to the first location on record). Staff
can transfer from there via the existing Inventory admin page
(`transferInventoryAction`) if the unit needs to go back to the location it
was originally sold from.

## Not built in V1

- No customer-initiated return request (this is a staff-initiated
  workflow from the order detail page — matches how JGP's two physical
  stores actually handle in-person returns/exchanges).
- No email notifications for return status changes (see `lib/email.ts` —
  the interface exists, no call sites wired in for returns yet).
- No partial-item photo/evidence attachment.
