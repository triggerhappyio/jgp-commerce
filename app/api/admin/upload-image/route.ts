import { NextRequest, NextResponse } from "next/server";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { uploadProductImage, assertStorageConfigured, StorageError } from "@/lib/storage";

// Every field the directive's "test unauthorized upload request" scenario
// cares about is checked here, server-side, before anything touches
// storage: session exists, role is staff, file type/size are validated
// inside uploadProductImage(). None of this is enforceable from the
// client — the client only ever sees the result.
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertStorageConfigured();

    const formData = await req.formData();
    const file = formData.get("file");
    const productId = formData.get("productId");

    if (!(file instanceof File) || typeof productId !== "string" || !productId) {
      return NextResponse.json({ error: "Missing file or productId." }, { status: 400 });
    }

    const { url } = await uploadProductImage(file, productId);
    return NextResponse.json({ url });
  } catch (err: any) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[upload-image] failed:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
