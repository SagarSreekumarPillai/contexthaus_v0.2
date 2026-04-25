export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

function getAnalyticsEndpoint(): string | null {
  const globalObj = globalThis as unknown as {
    __CH_ANALYTICS_ENDPOINT_OVERRIDE?: string;
  };

  const override = globalObj.__CH_ANALYTICS_ENDPOINT_OVERRIDE;
  if (override) return override;

  const envEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  return envEndpoint ?? null;
}

function sendToEndpoint(entry: { event: string; payload: AnalyticsPayload; timestamp: string }): void {
  if (typeof window === "undefined") return;
  const endpoint = getAnalyticsEndpoint();
  if (!endpoint) return;

  const body = JSON.stringify(entry);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const accepted = navigator.sendBeacon(endpoint, blob);
      if (accepted) return;
    }
  } catch {
    // Fallback to fetch below.
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Do not block product flow for analytics failures.
  });
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

