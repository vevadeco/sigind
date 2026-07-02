import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SESSION_COOKIE, validateSession } from "@/lib/auth-session";
import type { AnalysisResponse } from "@/lib/types";

export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function parseAnalysis(text: string): AnalysisResponse {
  const sections: AnalysisResponse = {
    patterns: "",
    trendAssessment: "",
    tradeEvaluation: "",
    summary: "",
  };

  const mapping: Array<[keyof AnalysisResponse, RegExp]> = [
    ["patterns", /(?:^|\n)#+\s*Patterns?\s*\n([\s\S]*?)(?=\n#+\s|$)/i],
    ["trendAssessment", /(?:^|\n)#+\s*Trend Assessment\s*\n([\s\S]*?)(?=\n#+\s|$)/i],
    ["tradeEvaluation", /(?:^|\n)#+\s*Trade (?:Setup )?Evaluation\s*\n([\s\S]*?)(?=\n#+\s|$)/i],
    ["summary", /(?:^|\n)#+\s*Summary\s*\n([\s\S]*?)$/i],
  ];

  for (const [key, regex] of mapping) {
    const match = text.match(regex);
    if (match?.[1]) sections[key] = match[1].trim();
  }

  if (!sections.patterns && !sections.summary) {
    sections.summary = text.trim();
  }

  return sections;
}

export async function POST(request: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const authed = await validateSession(token);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json({ error: "Analyzer is not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const entryPrice = Number(formData.get("entryPrice"));
    const takeProfit = Number(formData.get("takeProfit"));
    const stopLoss = Number(formData.get("stopLoss"));
    const imageType = String(formData.get("imageType") ?? "");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(imageType) && !ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PNG, JPEG, or WEBP." },
        { status: 400 }
      );
    }
    if (image.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 5 MB limit." }, { status: 400 });
    }
    if (![entryPrice, takeProfit, stopLoss].every((value) => Number.isFinite(value) && value > 0)) {
      return NextResponse.json(
        { error: "Entry, take-profit, and stop-loss must be positive numbers." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = ALLOWED_TYPES.has(image.type) ? image.type : imageType;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/png" | "image/jpeg" | "image/webp",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyze this candlestick chart screenshot for a proposed futures trade.
Entry: ${entryPrice}
Take Profit: ${takeProfit}
Stop Loss: ${stopLoss}

Respond in markdown with these exact section headings:
## Patterns
## Trend Assessment
## Trade Evaluation
## Summary

Be concise and focus only on what is visible in the screenshot.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Analysis could not be completed" }, { status: 500 });
    }

    return NextResponse.json(parseAnalysis(textBlock.text));
  } catch (error) {
    console.error("[analyze] Failed", error);
    return NextResponse.json({ error: "Analysis could not be completed" }, { status: 500 });
  }
}
