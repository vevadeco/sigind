import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, validateSession } from "@/lib/auth-session";
import { runScanner } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const authed = await validateSession(token);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const manualInterval = `manual-${new Date().toISOString()}`;
    const result = await runScanner(manualInterval);
    return NextResponse.json({
      success: true,
      signalsGenerated: result.signalsGenerated,
      skippedIdempotent: result.skippedIdempotent,
      message:
        result.signalsGenerated > 0
          ? `Scan complete. ${result.signalsGenerated} new signal(s) generated.`
          : "Scan complete. No new signals met the threshold.",
    });
  } catch (error) {
    console.error("[scan] Manual scan failed", error);
    const message =
      error instanceof Error ? error.message : "Scanner execution failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
