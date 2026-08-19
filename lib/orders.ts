// Order numbers are derived from Order.orderSeq, a real Postgres identity
// column (`@default(autoincrement())`). Using the DB sequence — instead of
// e.g. counting existing orders — means two concurrent checkouts can never
// be assigned the same number; Postgres guarantees each caller gets a
// distinct, monotonically increasing value with no extra locking needed.
export function formatOrderNumber(orderSeq: number): string {
  return `JGP-${10000 + orderSeq}`;
}
