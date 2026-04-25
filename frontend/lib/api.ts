const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  context_md: string;
  created_at: string;
  updated_at: string;
}

export interface IngestResult {
  status: string;
  source_id?: string;
  filename?: string;
  section_updated?: string;
  changes: Array<{ section: string; type: string; old?: string; new?: string }>;
  context_md: string;
  reason?: string;
}

export const api = {
  async getProperties(): Promise<Property[]> {
    const r = await fetch(`${BASE}/api/properties/`);
    return parseResponse<Property[]>(r);
  },

  async createProperty(name: string, address: string): Promise<Property> {
    const r = await fetch(`${BASE}/api/properties/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    return parseResponse<Property>(r);
  },

  async getProperty(id: string): Promise<Property> {
    const r = await fetch(`${BASE}/api/properties/${id}`);
    return parseResponse<Property>(r);
  },

  async ingestFile(propertyId: string, file: File, sourceType: string): Promise<IngestResult> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source_type", sourceType);
    const r = await fetch(`${BASE}/api/ingest/${propertyId}/source`, {
      method: "POST",
      body: fd,
    });
    return parseResponse<IngestResult>(r);
  },
};