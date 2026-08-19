import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the auth config — no providers, no Prisma, no
// bcrypt. Used by middleware.ts (which runs on the Edge runtime and can't
// load Node-only packages) purely to read/validate the session JWT and
// gate /admin routes by role. The full config with the Credentials
// provider lives in lib/auth.ts and only runs in the Node runtime (API
// routes, server components).
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/account/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = user.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
};
