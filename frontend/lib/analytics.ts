export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

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
  }
}

