export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getAnalyticsUrls(): string[] {
  const globalObj = globalThis as unknown as {
    __CH_ANALYTICS_ENDPOINT_OVERRIDE?: string;
  };

  const override = globalObj.__CH_ANALYTICS_ENDPOINT_OVERRIDE;
  if (override) return [override];

  const envEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (envEndpoint) return [envEndpoint];

  // Prefer original backend API; fall back to Next.js mock route if unreachable.
  return [`${API_BASE}/api/analytics/events`, "/api/analytics"];
}

function sendToEndpoint(entry: { event: string; payload: AnalyticsPayload; timestamp: string }): void {
  if (typeof window === "undefined") return;
  const urls = getAnalyticsUrls();
  const body = JSON.stringify(entry);

  void (async () => {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const isLast = i === urls.length - 1;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: isLast,
        });
        if (response.ok) return;
      } catch {
        // try next URL (e.g. backend down → mock route)
      }
    }
  })();
}

export function trackEvent(event: string, payload: AnalyticsPayload = {}): void {
  const entry = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  const globalObj = globalThis as unknown as {
    __chEvents?: Array<{ event: string; payload: AnalyticsPayload; timestamp: string }>;
  };

  if (!globalObj.__chEvents) {
    globalObj.__chEvents = [];
  }
  globalObj.__chEvents.push(entry);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ch:analytics", { detail: entry }));
    sendToEndpoint(entry);
  }
}
