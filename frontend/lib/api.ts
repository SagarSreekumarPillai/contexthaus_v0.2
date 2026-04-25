const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    try {
      const data = (await response.json()) as { detail?: string; error?: string };
      throw new Error(data.detail || data.error || `Request failed (${response.status})`);
    } catch {
      throw new Error(`Request failed (${response.status})`);
    }
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

  async getVendors(propertyId: string): Promise<Vendor[]> {
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}`);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseResponse<Vendor>(r);
  },

  async getVendorAvailability(vendorId: string): Promise<VendorAvailability[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/availability`);
    return parseResponse<VendorAvailability[]>(r);
  },

  async replaceVendorAvailability(
    vendorId: string,
    slots: Array<{ day_of_week: number; start_time: string; end_time: string }>
  ): Promise<VendorAvailability[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slots),
    });
    return parseResponse<VendorAvailability[]>(r);
  },

  async getVendorBookings(vendorId: string): Promise<VendorBooking[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/bookings`);
    return parseResponse<VendorBooking[]>(r);
  },

  async createVendorBooking(
    vendorId: string,
    data: { title: string; starts_at: string; ends_at: string; estimated_cost?: number; status?: string }
  ): Promise<VendorBooking> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const r = await fetch(`${BASE}/api/vendors/property/${propertyId}/recommendations?${params.toString()}`);
    return parseResponse<VendorRecommendation[]>(r);
  },

  async getVendorCommunications(vendorId: string): Promise<VendorCommunication[]> {
    const r = await fetch(`${BASE}/api/vendors/${vendorId}/communications`);
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseResponse<AutoDispatchResult>(r);
  },
};