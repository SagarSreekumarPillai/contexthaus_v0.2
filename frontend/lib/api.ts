import { clearToken, getToken } from "@/lib/auth";
import type { AuthUser, UserRole } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function formatApiErrorBody(data: unknown, status: number): string {
  if (!data || typeof data !== "object") {
    return `Request failed (${status})`;
  }
  const rec = data as Record<string, unknown>;
  const detail = rec.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (typeof rec.error === "string") {
    return rec.error;
  }
  return `Request failed (${status})`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Request failed (${response.status})`);
    }
    throw new Error(formatApiErrorBody(data, response.status));
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

export interface Vendor {
  id: string;
  property_id: string;
  name: string;
  service_type: string;
  contact_email: string;
  contact_phone: string;
  hourly_rate: number;
  currency: string;
  created_at: string;
}

export interface VendorAvailability {
  id: string;
  vendor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface VendorBooking {
  id: string;
  vendor_id: string;
  property_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  estimated_cost: number;
  created_at: string;
}

export interface VendorRecommendation {
  vendor: Vendor;
  reason: string;
  estimated_cost: number;
  is_available_for_slot: boolean;
  has_booking_conflict: boolean;
  next_open_window: string | null;
}

export interface VendorCommunication {
  id: string;
  vendor_id: string;
  property_id: string;
  booking_id: string | null;
  channel: "email" | "call" | "sms";
  direction: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface AutoDispatchResult {
  recommendation: VendorRecommendation;
  booking: VendorBooking;
  communication: VendorCommunication;
}

export interface OrgUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  assigned_property_ids: string[];
}

export interface AuditRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id: string | null;
  detail: string;
  created_at: string;
}

export const api = {
  async bootstrap(body: {
    organization_name: string;
    admin_email: string;
    admin_password: string;
    admin_full_name?: string;
  }): Promise<{ access_token: string; token_type: string; user: AuthUser }> {
    const r = await fetch(`${BASE}/api/auth/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseResponse(r);
  },

  async login(email: string, password: string): Promise<{ access_token: string; token_type: string; user: AuthUser }> {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return parseResponse(r);
  },

  async listUsers(): Promise<OrgUser[]> {
    const r = await fetch(`${BASE}/api/users/`, { headers: authHeaders() });
    return parseResponse<OrgUser[]>(r);
  },

  async createUser(body: {
    email: string;
    password: string;
    full_name?: string;
    role: UserRole;
  }): Promise<OrgUser> {
    const r = await fetch(`${BASE}/api/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    return parseResponse<OrgUser>(r);
  },

  async patchUser(
    userId: string,
    body: { full_name?: string; role?: UserRole; is_active?: boolean }
  ): Promise<OrgUser> {
    const r = await fetch(`${BASE}/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    return parseResponse<OrgUser>(r);
  },

  async setUserAssignments(userId: string, propertyIds: string[]): Promise<OrgUser> {
    const r = await fetch(`${BASE}/api/users/${userId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ property_ids: propertyIds }),
    });
    return parseResponse<OrgUser>(r);
  },

  async listAudit(limit = 200): Promise<AuditRow[]> {
    const r = await fetch(`${BASE}/api/audit/?limit=${limit}`, { headers: authHeaders() });
    return parseResponse<AuditRow[]>(r);
  },

  async getProperties(): Promise<Property[]> {
    const r = await fetch(`${BASE}/api/properties/`, { headers: authHeaders() });
    return parseResponse<Property[]>(r);
  },

  async createProperty(name: string, address: string): Promise<Property> {
    const r = await fetch(`${BASE}/api/properties/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, address }),
    });
    return parseResponse<Property>(r);
  },

  async getProperty(id: string): Promise<Property> {
    const r = await fetch(`${BASE}/api/properties/${id}`, { headers: authHeaders() });
    return parseResponse<Property>(r);
  },

  async deleteProperty(id: string): Promise<{ deleted: string }> {
    const r = await fetch(`${BASE}/api/properties/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return parseResponse<{ deleted: string }>(r);
  },

  async ingestFile(propertyId: string, file: File, sourceType: string): Promise<IngestResult> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source_type", sourceType);
    const r = await fetch(`${BASE}/api/ingest/${propertyId}/source`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    return parseResponse<IngestResult>(r);
  },

  async getVendors(propertyId: string): Promise<Vendor[]> {
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}`, { headers: authHeaders() });
    return parseResponse<Vendor[]>(r);
  },

  async createVendor(
    propertyId: string,
    data: {
      name: string;
      service_type: string;
      contact_email?: string;
      contact_phone?: string;
      hourly_rate?: number;
      currency?: string;
      availability?: Array<{ day_of_week: number; start_time: string; end_time: string }>;
    }
  ): Promise<Vendor> {
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse<Vendor>(r);
  },

  async getVendorAvailability(vendorId: string): Promise<VendorAvailability[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/availability`, { headers: authHeaders() });
    return parseResponse<VendorAvailability[]>(r);
  },

  async replaceVendorAvailability(
    vendorId: string,
    slots: Array<{ day_of_week: number; start_time: string; end_time: string }>
  ): Promise<VendorAvailability[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(slots),
    });
    return parseResponse<VendorAvailability[]>(r);
  },

  async getVendorBookings(vendorId: string): Promise<VendorBooking[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/bookings`, { headers: authHeaders() });
    return parseResponse<VendorBooking[]>(r);
  },

  async createVendorBooking(
    vendorId: string,
    data: { title: string; starts_at: string; ends_at: string; estimated_cost?: number; status?: string }
  ): Promise<VendorBooking> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse<VendorBooking>(r);
  },

  async getVendorRecommendations(
    propertyId: string,
    serviceType: string,
    startsAtIso: string,
    endsAtIso: string
  ): Promise<VendorRecommendation[]> {
    const params = new URLSearchParams({
      service_type: serviceType,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    });
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}/recommendations?${params.toString()}`, {
      headers: authHeaders(),
    });
    return parseResponse<VendorRecommendation[]>(r);
  },

  async getVendorCommunications(vendorId: string): Promise<VendorCommunication[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/communications`, { headers: authHeaders() });
    return parseResponse<VendorCommunication[]>(r);
  },

  async createVendorCommunication(
    vendorId: string,
    data: {
      channel: "email" | "call" | "sms";
      direction?: string;
      subject?: string;
      message: string;
      status?: string;
      booking_id?: string;
    }
  ): Promise<VendorCommunication> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse<VendorCommunication>(r);
  },

  async autoDispatchVendor(
    propertyId: string,
    data: {
      service_type: string;
      issue_title: string;
      issue_description?: string;
      priority?: "low" | "medium" | "high" | "urgent";
      target_starts_at?: string;
      duration_minutes?: number;
      allow_outside_hours?: boolean;
    }
  ): Promise<AutoDispatchResult> {
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}/auto-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse<AutoDispatchResult>(r);
  },
};
