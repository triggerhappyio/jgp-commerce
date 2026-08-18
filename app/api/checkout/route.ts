import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// Requires STRIPE_SECRET_KEY in your environment (test key while developing,
// live key only once you've gone through Stripe's account activation).
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20"
});

export async function POST(req: NextRequest) {
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
  const items: { slug: string; qty: number }[] = body.items || [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";

  try {
    // Prices are always computed here, from the catalog — never trusted from
    // the client cart.
    const line_items = await Promise.all(
      items.map(async (item) => {
        const variant = await prisma.productVariant.findUnique({
          where: { sku: item.slug },
          include: { product: true }
        });
        if (!variant) throw new Error(`Unknown product: ${item.slug}`);
        return {
          quantity: item.qty,
          price_data: {
            currency: "usd",
            product_data: { name: variant.product.name },
            unit_amount: variant.priceCents
          }
        };
      })
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: body.email || undefined,
      shipping_address_collection: { allowed_countries: ["US"] },
      metadata: {
        items: JSON.stringify(items)
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`
    });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
