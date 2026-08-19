"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => signOut({ callbackUrl: "/" })}>
      Sign Out
    </button>
  );
}
