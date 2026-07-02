import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/schemas/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "CLIENT";
      locale: "sk" | "en";
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "CLIENT";
    locale: "sk" | "en";
    tokenVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "CLIENT";
    locale: "sk" | "en";
    tokenVersion: number;
  }
}

/**
 * Auth.js v5 (NextAuth) configuration.
 * - Credentials provider only (self-hosted, no external IdP — spec/02-architecture.md §1).
 * - Passwords hashed with argon2id (spec/02-architecture.md §4.4).
 * - JWT session strategy, 30-day rolling lifetime (spec/04-features.md §1).
 * - `tokenVersion` embedded in the JWT and compared against `User.tokenVersion` on every
 *   request so "logout everywhere" (rotate the DB value) invalidates existing sessions
 *   without a server-side session store.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // rolling: refresh once per day of activity
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) {
          return null;
        }

        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locale: user.locale,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.locale = user.locale;
        token.tokenVersion = user.tokenVersion;
      }

      // Allow client-side `update()` calls (e.g. after a locale change) to patch the token.
      if (trigger === "update" && session?.locale) {
        token.locale = session.locale;
      }

      // Re-validate token version + active status periodically so a deactivated user or
      // a "logout everywhere" action takes effect without waiting for full re-login.
      if (token.id) {
        const current = await db.user.findUnique({
          where: { id: token.id },
          select: { tokenVersion: true, isActive: true },
        });
        if (!current || !current.isActive || current.tokenVersion !== token.tokenVersion) {
          return null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.locale = token.locale;
      }
      return session;
    },
  },
});
