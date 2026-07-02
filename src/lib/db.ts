import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In dev, Next.js hot-reloads modules, which would otherwise
 * create a new PrismaClient (and a new connection pool) on every edit — so we stash the
 * instance on `globalThis` and reuse it.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
