import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const STAFF_ROLES = ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"];

// Server-side gate for /admin — this, not hiding nav links, is what
// actually protects staff routes. Runs on the Edge runtime, so it only
// reads the already-issued JWT (via the edge-safe authConfig) rather than
// touching Prisma/bcrypt directly.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") return;

  const role = (req.auth?.user as any)?.role;
  if (!req.auth || !STAFF_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
});

export const config = {
  matcher: ["/admin/:path*"]
};
