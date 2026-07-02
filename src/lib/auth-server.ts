import { randomBytes } from "crypto";
import { getDb } from "./db/index";
import { sessions } from "./db/schema";

const SESSION_HOURS = 24;

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(sessions).values({ token, expiresAt });
  return token;
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.APP_USERNAME?.trim();
  const expectedPassword = process.env.APP_PASSWORD?.trim();
  if (!expectedUsername || !expectedPassword) return false;
  return username === expectedUsername && password === expectedPassword;
}
