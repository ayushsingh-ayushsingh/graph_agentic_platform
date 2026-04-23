"use server"

import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { db } from "@/src"
import { user } from "@/src/db/schema"
import { auth } from "@/lib/auth"

// ---------------------------------------------------------------------------
// updateProfile
// Allows the authenticated user to update their display name and avatar URL.
// ---------------------------------------------------------------------------

export interface UpdateProfileInput {
  name?: string
  image?: string
}

export async function updateProfile(
  input: UpdateProfileInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const trimmedName = input.name?.trim()
    const trimmedImage = input.image?.trim()

    if (trimmedName !== undefined && trimmedName.length === 0) {
      return { success: false, error: "Name cannot be empty" }
    }

    await db
      .update(user)
      .set({
        ...(trimmedName !== undefined && { name: trimmedName }),
        ...(trimmedImage !== undefined && { image: trimmedImage || null }),
      })
      .where(eq(user.id, session.user.id))

    return { success: true }
  } catch (err) {
    console.error("[updateProfile]", err)
    return { success: false, error: "Internal server error" }
  }
}
