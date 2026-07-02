import { NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScanner();
    return NextResponse.json({
      success: true,
      signalsGenerated: result.signalsGenerated,
      skippedIdempotent: result.skippedIdempotent,
    });
  } catch (error) {
    console.error("[cron] Scanner failed", error);
    return NextResponse.json({ success: false, error: "Scanner execution failed" }, { status: 500 });
  }
}
