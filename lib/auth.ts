import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";

// Credentials provider + JWT sessions — NOT the Prisma adapter. Auth.js's
// database adapter is designed around providers that create Account rows
// (OAuth, email magic-link); Credentials intentionally bypasses that, so
// mixing the two is a known footgun. User/Account/Session/VerificationToken
// still exist in schema.prisma for when an OAuth or magic-link provider is
// added later — this just doesn't wire the adapter in yet.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawEmail || !password) return null;
        // Must match the normalization registration applies (see
        // app/api/auth/register/route.ts) — otherwise a user who registers
        // as "Foo@Example.com" (stored lowercase) can't log back in by
        // typing the same address with different casing.
        const email = rawEmail.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }
    })
  ]
});

export const STAFF_ROLES: Role[] = [Role.STAFF, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];
