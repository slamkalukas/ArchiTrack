import { NextResponse, type NextRequest } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { handleApiError, apiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { updateMeSchema } from "@/features/projects";

/** GET /api/me — own profile (spec/05-api.md §8). */
export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await db.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        phone: true,
        avatarUrl: true,
        emailDigest: true,
      },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/me — profile, locale, emailDigest, password change (spec/05-api.md §8).
 * Password change requires `currentPassword` to verify identity before setting
 * `newPassword` (defense in depth beyond the session cookie).
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const sessionUser = await requireUser();
    const body = updateMeSchema.parse(await request.json());

    if (body.newPassword && !body.currentPassword) {
      return apiError(400, "validation_error", "Current password is required to set a new password.");
    }

    const data: {
      name?: string;
      locale?: "sk" | "en";
      phone?: string | null;
      emailDigest?: boolean;
      passwordHash?: string;
    } = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.locale !== undefined) data.locale = body.locale;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.emailDigest !== undefined) data.emailDigest = body.emailDigest;

    if (body.newPassword) {
      const current = await db.user.findUniqueOrThrow({
        where: { id: sessionUser.id },
        select: { passwordHash: true },
      });
      const valid = current.passwordHash && (await argon2.verify(current.passwordHash, body.currentPassword!));
      if (!valid) {
        return apiError(400, "invalid_password", "Current password is incorrect.");
      }
      data.passwordHash = await argon2.hash(body.newPassword, { type: argon2.argon2id });
    }

    const user = await db.user.update({
      where: { id: sessionUser.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        phone: true,
        avatarUrl: true,
        emailDigest: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
