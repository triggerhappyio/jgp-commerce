import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { reserveInventory, releaseReservationsForAttempt } from "@/lib/inventory";
import { automaticTaxParam } from "@/lib/tax";
import { shippingOptionsParam } from "@/lib/shipping";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20"
});

const RESERVATION_SECONDS = 30 * 60; // must match lib/inventory.ts RESERVATION_TTL_MS

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(clientKeyFrom(req, "checkout"), 20, 10 * 60 * 1000); // 20/10min/IP
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again shortly." }, { status: 429 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment." },
      { status: 500 }
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error:
          "Catalog database is not configured yet. Add DATABASE_URL, run `npx prisma migrate dev`, then `npm run db:seed`."
      },
      { status: 500 }
    );
  }

  const body = await req.json();
  const items: { variantId: string; qty: number }[] = body.items || [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }
  if (items.some((i) => !Number.isInteger(i.qty) || i.qty <= 0)) {
    return NextResponse.json({ error: "Invalid quantity." }, { status: 400 });
  }

  const checkoutAttemptId = randomUUID();
  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    // Reserve stock for every line first, inside one transaction — if any
    // line can't be held, nothing is held and the customer gets a real
    // "out of stock" answer before Stripe is ever involved.
    const lineData = await prisma.$transaction(async (tx) => {
      const lines = [];
      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true }
        });
        if (!variant || !variant.active) {
          throw new CheckoutError(`One of the items in your cart is no longer available.`);
        }

        const reservation = await reserveInventory(tx, {
          variantId: variant.id,
          quantity: item.qty,
          checkoutAttemptId
        });
        if (!reservation.ok) {
          throw new CheckoutError(
            `Only limited stock left for ${variant.product.name}${variant.color ? ` (${variant.color}` : ""}${
              variant.size ? `${variant.color ? ", " : "("}size ${variant.size})` : variant.color ? ")" : ""
            } — please reduce the quantity.`
          );
        }

        lines.push({
          quantity: item.qty,
          price_data: {
            currency: "usd",
            product_data: {
              name: [variant.product.name, variant.color, variant.size ? `Size ${variant.size}` : null]
                .filter(Boolean)
                .join(" — ")
            },
            unit_amount: variant.priceCents
          },
          _unitAmount: variant.priceCents // read below to compute subtotal for the shipping quote
        });
      }
      return lines;
    });

    // Server-computed subtotal drives the shipping quote — never trust a
    // client-submitted amount here. Tax is handled entirely by Stripe Tax
    // (automaticTaxParam) once the operator has activated it — see
    // docs/TAX_SETUP.md; until then it stays off rather than pretending to
    // calculate tax it isn't actually configured to calculate.
    const subtotalCents = lineData.reduce((sum, l) => sum + l._unitAmount * l.quantity, 0);
    const line_items = lineData.map(({ _unitAmount, ...line }) => line);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // V1 supports only immediate card payments. Left unset, Stripe uses
      // whatever's enabled in the Dashboard, which could include delayed
      // methods (e.g. bank debits) whose payment_status stays "unpaid"
      // through checkout.session.completed and only resolves later via
      // async_payment_succeeded/failed — events this app doesn't handle.
      // Pinning to card keeps that whole class of bug out of scope.
      payment_method_types: ["card"],
      line_items,
      client_reference_id: checkoutAttemptId,
      customer_email: body.email || undefined,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: shippingOptionsParam(subtotalCents),
      automatic_tax: automaticTaxParam(),
      expires_at: Math.floor(Date.now() / 1000) + RESERVATION_SECONDS,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // Whatever failed after reservations were taken (or the reservation
    // step itself threw) — give the held stock back rather than leaving it
    // stranded until the expiry cron catches it.
    await prisma
      .$transaction((tx) => releaseReservationsForAttempt(tx, checkoutAttemptId))
      .catch((releaseErr) => console.error("[checkout] failed to release reservations", releaseErr));

    const message = err instanceof CheckoutError ? err.message : err.message || "Something went wrong.";
    return NextResponse.json({ error: message }, { status: err instanceof CheckoutError ? 409 : 500 });
  }
}

class CheckoutError extends Error {}
