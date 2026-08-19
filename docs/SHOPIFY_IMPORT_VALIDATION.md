# Shopify Import Validation

Fill this in after each real import dry-run (`scripts/shopify-import/import-*.ts`
against staging, per `docs/SHOPIFY_MIGRATION.md`), using
`npm run reconcile:shopify -- --inventory ... --products ... --customers ... --orders ...`
to get the counts below. This has not been run yet — no real Shopify
export exists in the environment this tooling was built in. Template only.

## Run metadata

- Date/time:
- Environment: staging
- Shopify export pulled at:
- Operator:

## Counts

```text
Shopify products:              X
Imported products:             X
Match: YES / NO

Shopify variants:               X
Imported variants:              X
Match: YES / NO

Shopify customers:              X
Imported customers:             X
Match: YES / NO (a JGP count higher than Shopify's is expected if any
                 organic guest checkouts happened on staging before import)

Shopify historical orders:      X
Imported (legacy-tagged) orders: X
Match: YES / NO
```

## Inventory reconciliation

Paste the `reconcile:shopify` inventory table output here, or summarize:

```text
Total SKUs compared:    X
Mismatches:             X
```

## Flagged mismatches

List every mismatch found, with a resolution or explicit "accepted, because
<reason>" — do not silently proceed cutover with unexplained mismatches.

```text
SKU              Issue                          Resolution
```

## Sign-off

- [ ] All counts reconciled or explicitly explained above
- [ ] No duplicate products/customers/orders from re-running imports
- [ ] Ready to proceed to `docs/LAUNCH_RUNBOOK.md` cutover steps
