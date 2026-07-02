import { eq, lt } from "drizzle-orm";
import { getDb } from "./db/index";
import { sessions } from "./db/schema";

export const SESSION_COOKIE = "scanner_session";

export async function validateSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);
    const session = rows[0];
    if (!session) return false;
    return session.expiresAt.getTime() > Date.now();
  } catch {
    return false;
  }
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const db = getDb();
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  } catch {
    // Non-critical cleanup
  }
}
