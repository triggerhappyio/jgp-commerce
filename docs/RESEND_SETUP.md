# Resend (Transactional Email) Setup

1. Go to **resend.com**, create an account.
2. Domains → Add Domain → enter JGP's sending domain (or a subdomain like
   `mail.jgpfootwear.store`) and add the DNS records it gives you (SPF,
   DKIM) at your DNS provider. Wait for verification (usually minutes,
   can take longer).
3. API Keys → Create API Key → copy it.
4. Set:
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=orders@<your-verified-domain>
   ```
   `EMAIL_FROM` must be an address on the **verified** domain from step 2
   — Resend will reject sends from an unverified domain.
5. Set both in Vercel, scoped to Preview and Production (a real verified
   domain is needed either way — sending from an unverified domain fails
   in Preview too, not just Production).
6. Redeploy.

## What's already wired to send

`lib/email.ts` — order confirmation (on payment), shipping confirmation
(on marking an order Shipped), refund confirmation, account-verification
(on registering with an email that has existing guest order history).
None of these need code changes once the two env vars above are set —
`sendEmail()` automatically switches from "log only" to "actually send"
in the same deploy.

## Test it worked

Trigger any of the four flows above against staging (e.g. register with
an email that already has a guest order on staging) and confirm the email
arrives. Or check the Resend Dashboard → Emails log for a "Delivered"
(not "Failed") entry after triggering one.
