import { NextRequest, NextResponse } from "next/server";

type AnalyticsEvent = {
  event?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
};

export async function POST(request: NextRequest) {
  let body: AnalyticsEvent | null = null;
  try {
    body = (await request.json()) as AnalyticsEvent;
  } catch {
    return NextResponse.json({ error: "invalid analytics payload" }, { status: 400 });
  }

  // Mock sink for local development. Replace with persistent storage later.
  console.log("[analytics]", {
    event: body.event ?? "unknown",
    payload: body.payload ?? {},
    timestamp: body.timestamp ?? new Date().toISOString(),
  });

  return new NextResponse(null, { status: 204 });
}

