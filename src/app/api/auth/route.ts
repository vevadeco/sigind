import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth-server";
import { cleanupExpiredSessions, SESSION_COOKIE } from "@/lib/auth-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    if (!verifyCredentials(body.username ?? "", body.password ?? "")) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    await cleanupExpiredSessions();
    const token = await createSession();
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    console.error("[auth] Login failed", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
