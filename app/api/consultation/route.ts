import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, notes, location } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  try {
    const lead = await prisma.consultation.create({
      data: { name, email, phone, notes, location }
    });
    // TODO: send a notification to store staff (Resend/Postmark) and a
    // confirmation email to the customer once an email provider is wired in.
    return NextResponse.json({ id: lead.id });
  } catch (err: any) {
    return NextResponse.json({ error: "Could not save your request. Try again." }, { status: 500 });
  }
}
