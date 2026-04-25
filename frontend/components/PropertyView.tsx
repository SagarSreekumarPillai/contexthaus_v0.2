"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  api,
  Property,
  IngestResult,
  Vendor,
  VendorAvailability,
  VendorBooking,
  VendorRecommendation,
  VendorCommunication,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

interface Props {
  property: Property;
  onUpdate: (p: Property) => void;
}

const SOURCE_TYPES = ["email", "pdf", "erp", "slack", "other"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PropertyView({ property, onUpdate }: Props) {
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState("");
  const [lastAttemptFile, setLastAttemptFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceType, setSourceType] = useState("email");
  const [changedSections, setChangedSections] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [availability, setAvailability] = useState<VendorAvailability[]>([]);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [vendorError, setVendorError] = useState("");
  const [recommendations, setRecommendations] = useState<VendorRecommendation[]>([]);
  const [communications, setCommunications] = useState<VendorCommunication[]>([]);
  const [contactDraft, setContactDraft] = useState({
    channel: "email" as "email" | "call" | "sms",
    subject: "",
    message: "",
    booking_id: "",
  });
  const [dispatchDraft, setDispatchDraft] = useState({
    service_type: "plumbing",
    issue_title: "",
    issue_description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    duration_minutes: "120",
    allow_outside_hours: false,
  });
  const [newVendor, setNewVendor] = useState({
    name: "",
    service_type: "plumbing",
    contact_email: "",
    contact_phone: "",
    hourly_rate: "95",
    currency: "EUR",
  });
  const [newBooking, setNewBooking] = useState({
    title: "",
    starts_at: "",
    ends_at: "",
    estimated_cost: "0",
  });
  const [availabilityDraft, setAvailabilityDraft] = useState({
    day_of_week: "0",
    start_time: "09:00",
    end_time: "17:00",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadVendors = useCallback(async () => {
    setVendorLoading(true);
    setVendorError("");
    try {
      const list = await api.getVendors(property.id);
      setVendors(list);
      if (list.length > 0) {
        setSelectedVendorId((prev) => prev || list[0].id);
      } else {
        setSelectedVendorId("");
      }
    } catch {
      setVendorError("Could not load vendors.");
    } finally {
      setVendorLoading(false);
    }
  }, [property.id]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadVendors();
    });
  }, [loadVendors]);

  useEffect(() => {
    if (!selectedVendorId) {
      Promise.resolve().then(() => {
        setAvailability([]);
        setBookings([]);
        setCommunications([]);
      });
      return;
    }
    Promise.resolve().then(() => {
      Promise.all([
        api.getVendorAvailability(selectedVendorId),
        api.getVendorBookings(selectedVendorId),
        api.getVendorCommunications(selectedVendorId),
      ])
        .then(([slots, bookingList, comms]) => {
          setAvailability(slots);
          setBookings(bookingList);
          setCommunications(comms);
        })
        .catch(() => {
          setVendorError("Could not load vendor details.");
        });
    });
  }, [selectedVendorId]);

  useEffect(() => {
    if (!newBooking.starts_at || !newBooking.ends_at || vendors.length === 0) {
      Promise.resolve().then(() => {
        setRecommendations([]);
      });
      return;
    }
    const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
    const targetService = selectedVendor?.service_type ?? vendors[0].service_type;
    Promise.resolve().then(() => {
      setRecommendationLoading(true);
      api.getVendorRecommendations(
        property.id,
        targetService,
        new Date(newBooking.starts_at).toISOString(),
        new Date(newBooking.ends_at).toISOString()
      )
        .then((result) => {
          setRecommendations(result);
        })
        .catch(() => {
          setRecommendations([]);
        })
        .finally(() => {
          setRecommendationLoading(false);
        });
      });
  }, [newBooking.starts_at, newBooking.ends_at, selectedVendorId, vendors, property.id]);

  const createVendor = async () => {
    if (!newVendor.name.trim()) return;
    try {
      const created = await api.createVendor(property.id, {
        name: newVendor.name.trim(),
        service_type: newVendor.service_type,
        contact_email: newVendor.contact_email,
        contact_phone: newVendor.contact_phone,
        hourly_rate: Number(newVendor.hourly_rate) || 0,
        currency: newVendor.currency || "EUR",
      });
      setVendors((prev) => [created, ...prev]);
      setSelectedVendorId(created.id);
      setNewVendor({
        name: "",
        service_type: "plumbing",
        contact_email: "",
        contact_phone: "",
        hourly_rate: "95",
        currency: "EUR",
      });
      trackEvent("vendor_created", { propertyId: property.id, vendorId: created.id });
    } catch {
      setVendorError("Could not create vendor.");
    }
  };

  const addAvailabilitySlot = async () => {
    if (!selectedVendorId) return;
    const updatedSlots = [
      ...availability.map((slot) => ({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
      })),
      {
        day_of_week: Number(availabilityDraft.day_of_week),
        start_time: availabilityDraft.start_time,
        end_time: availabilityDraft.end_time,
      },
    ];
    try {
      const updated = await api.replaceVendorAvailability(selectedVendorId, updatedSlots);
      setAvailability(updated);
      trackEvent("vendor_availability_updated", { propertyId: property.id, vendorId: selectedVendorId });
    } catch {
      setVendorError("Could not update vendor availability.");
    }
  };

  const createBooking = async () => {
    if (!selectedVendorId || !newBooking.title || !newBooking.starts_at || !newBooking.ends_at) return;
    try {
      const booking = await api.createVendorBooking(selectedVendorId, {
        title: newBooking.title,
        starts_at: new Date(newBooking.starts_at).toISOString(),
        ends_at: new Date(newBooking.ends_at).toISOString(),
        estimated_cost: Number(newBooking.estimated_cost) || 0,
      });
      setBookings((prev) => [...prev, booking].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setNewBooking({ title: "", starts_at: "", ends_at: "", estimated_cost: "0" });
      trackEvent("vendor_booking_created", { propertyId: property.id, vendorId: selectedVendorId, bookingId: booking.id });
    } catch (error) {
      setVendorError(error instanceof Error ? error.message : "Could not create booking.");
    }
  };

  const sendCommunication = async () => {
    if (!selectedVendorId || !contactDraft.message.trim()) return;
    try {
      const created = await api.createVendorCommunication(selectedVendorId, {
        channel: contactDraft.channel,
        subject: contactDraft.subject,
        message: contactDraft.message,
        status: "sent",
        booking_id: contactDraft.booking_id || undefined,
      });
      setCommunications((prev) => [created, ...prev]);
      setContactDraft((prev) => ({
        ...prev,
        subject: "",
        message: "",
      }));
      trackEvent("vendor_communication_sent", {
        propertyId: property.id,
        vendorId: selectedVendorId,
        channel: created.channel,
      });
    } catch (error) {
      setVendorError(error instanceof Error ? error.message : "Could not send vendor communication.");
    }
  };

  const autoDispatch = async () => {
    if (!dispatchDraft.issue_title.trim()) return;
    try {
      const result = await api.autoDispatchVendor(property.id, {
        service_type: dispatchDraft.service_type,
        issue_title: dispatchDraft.issue_title.trim(),
        issue_description: dispatchDraft.issue_description,
        priority: dispatchDraft.priority,
        duration_minutes: Number(dispatchDraft.duration_minutes) || 120,
        allow_outside_hours: dispatchDraft.allow_outside_hours,
      });
      setSelectedVendorId(result.recommendation.vendor.id);
      setBookings((prev) => [...prev, result.booking].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setCommunications((prev) => [result.communication, ...prev]);
      setVendorError("");
      trackEvent("vendor_auto_dispatch_created", {
        propertyId: property.id,
        vendorId: result.recommendation.vendor.id,
        bookingId: result.booking.id,
      });
    } catch (error) {
      setVendorError(error instanceof Error ? error.message : "Auto-dispatch failed.");
    }
  };

  const ingest = useCallback(async (file: File) => {
    setIngesting(true);
    setIngestError("");
    setLastResult(null);
    try {
      const result = await api.ingestFile(property.id, file, sourceType);
      setLastResult(result);
      setLastAttemptFile(null);
      trackEvent("ingest_succeeded", { propertyId: property.id, sourceType, status: result.status });
      if (result.status === "ingested") {
        const updated = await api.getProperty(property.id);
        onUpdate(updated);
        setChangedSections(result.changes.map(c => c.section));
        setTimeout(() => setChangedSections([]), 3000);
      }
    } catch {
      setIngestError("Ingest failed. Please retry.");
      setLastAttemptFile(file);
      trackEvent("ingest_failed", { propertyId: property.id, sourceType });
    } finally {
      setIngesting(false);
    }
  }, [property.id, sourceType, onUpdate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) ingest(file);
  }, [ingest]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) ingest(file);
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[\s\S]+?\*\*)/g);
    if (parts.length === 1) return text;
    return (
      <>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </>
    );
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split("\n");
    return lines.map((line, i) => {
      const isH1 = line.startsWith("# ");
      const isH2 = line.startsWith("## ");
      const isH3 = line.startsWith("### ");
      const bulletMatch = line.match(/^(\s*)- (.*)/s);
      const isBullet = bulletMatch !== null;
      const isSeparator = line === "---";

      const sectionName = isH2 ? line.replace("## ", "") : null;
      const isChanged = sectionName && changedSections.includes(sectionName);

      if (isH1) return (
        <div key={i} className="heading" style={{ fontSize: 20, fontWeight: 800, color: "var(--amber)", marginTop: 8, marginBottom: 4 }}>
          {renderInline(line.replace("# ", ""))}
        </div>
      );
      if (isH2) return (
        <div key={i} className={isChanged ? "diff-flash" : ""} style={{
          fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 16, marginBottom: 6,
          padding: "4px 8px", background: "var(--surface)",
          fontFamily: "Syne, sans-serif", letterSpacing: "0.05em",
          borderLeft: isChanged ? "2px solid var(--amber)" : "2px solid var(--border)",
        }}>
          {line.replace("## ", "").toUpperCase()}
        </div>
      );
      if (isH3) return (
        <div key={i} style={{ color: "var(--amber-dim)", fontWeight: 500, marginTop: 8 }}>
          {renderInline(line.replace("### ", ""))}
        </div>
      );
      if (isBullet && bulletMatch) return (
        <div key={i} style={{ paddingLeft: 16 + bulletMatch[1].length * 8, color: "var(--text)", lineHeight: 1.8 }}>
          <span style={{ color: "var(--amber)" }}>→ </span>
          {renderInline(bulletMatch[2])}
        </div>
      );
      if (isSeparator) return (
        <div key={i} style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />
      );
      if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
      return (
        <div key={i} style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
          {renderInline(line)}
        </div>
      );
    });
  };

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div className="heading" style={{ fontSize: 18, fontWeight: 800 }} data-testid="selected-property-title">{property.name}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{property.address}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--text)", padding: "6px 10px", fontFamily: "inherit",
              fontSize: 11, outline: "none", cursor: "pointer",
            }}
          >
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={ingesting}
            data-testid="ingest-file-button"
            style={{
              padding: "6px 16px", background: ingesting ? "var(--border)" : "var(--amber)",
              color: ingesting ? "var(--text-muted)" : "#000", border: "none",
              cursor: ingesting ? "not-allowed" : "pointer", fontFamily: "inherit",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
            }}
          >
            {ingesting ? "PROCESSING..." : "↑ INGEST FILE"}
          </button>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onFileChange}
            data-testid="ingest-file-input"
            accept=".txt,.pdf,.eml,.md,.csv,.json" />
        </div>
      </div>

      {/* Status Bar */}
      {ingestError && (
        <div className="fade-in" style={{
          padding: "8px 24px", fontSize: 11,
          background: "rgba(248,113,113,0.1)",
          borderBottom: "1px solid var(--border)",
          color: "var(--red)",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span data-testid="ingest-error-message">{ingestError}</span>
          {lastAttemptFile && (
            <button
              type="button"
              onClick={() => {
                trackEvent("ingest_retry_clicked", { propertyId: property.id, sourceType });
                ingest(lastAttemptFile);
              }}
              data-testid="retry-ingest-button"
              style={{
                border: "1px solid var(--red)",
                color: "var(--red)",
                background: "transparent",
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Retry ingest
            </button>
          )}
        </div>
      )}
      {lastResult && (
        <div className="fade-in" style={{
          padding: "8px 24px", fontSize: 11,
          background: lastResult.status === "ignored" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
          borderBottom: "1px solid var(--border)",
          color: lastResult.status === "ignored" ? "var(--red)" : "var(--green)",
          display: "flex", gap: 16,
        }}>
          <span>
            {lastResult.status === "ignored"
              ? `⊘ IGNORED — ${lastResult.reason}`
              : `✓ INGESTED — ${lastResult.filename}`}
          </span>
          {lastResult.status === "ingested" && lastResult.changes.length > 0 && (
            <span style={{ color: "var(--amber)" }}>
              ↺ UPDATED: {lastResult.changes.map(c => c.section).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Drop Zone + Markdown */}
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "24px",
            background: dragOver ? "rgba(245,166,35,0.03)" : "transparent",
            border: dragOver ? "1px dashed var(--amber)" : "1px dashed transparent",
            transition: "all 0.2s",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {property.context_md ? (
            <div style={{ maxWidth: 720 }}>
              {renderMarkdown(property.context_md)}
            </div>
          ) : (
            <div style={{
              height: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", flexDirection: "column", gap: 12,
              color: "var(--text-muted)", minHeight: 400,
            }}>
              <div style={{ fontSize: 40 }}>⬆</div>
              <div className="heading" style={{ fontSize: 16, fontWeight: 700 }}>
                DROP A FILE TO GENERATE CONTEXT
              </div>
              <div style={{ fontSize: 11 }}>
                Accepts: email (.eml, .txt), PDF, Slack export, ERP CSV
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 360, borderLeft: "1px solid var(--border)", overflowY: "auto", padding: 16 }}>
          <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 10, letterSpacing: "0.1em" }}>
            VENDORS + BOOKINGS
          </div>
          {vendorError && <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 8 }}>{vendorError}</div>}
          {vendorLoading && <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>Loading vendors...</div>}

          <div style={{ border: "1px solid var(--border)", padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>Add Vendor</div>
            <input
              placeholder="Vendor name"
              value={newVendor.name}
              onChange={(e) => setNewVendor((prev) => ({ ...prev, name: e.target.value }))}
              style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            />
            <input
              placeholder="Service type (e.g. roofing)"
              value={newVendor.service_type}
              onChange={(e) => setNewVendor((prev) => ({ ...prev, service_type: e.target.value }))}
              style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            />
            <input
              placeholder="Email"
              value={newVendor.contact_email}
              onChange={(e) => setNewVendor((prev) => ({ ...prev, contact_email: e.target.value }))}
              style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            />
            <input
              placeholder="Phone"
              value={newVendor.contact_phone}
              onChange={(e) => setNewVendor((prev) => ({ ...prev, contact_phone: e.target.value }))}
              style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            />
            <input
              placeholder="Hourly rate"
              value={newVendor.hourly_rate}
              onChange={(e) => setNewVendor((prev) => ({ ...prev, hourly_rate: e.target.value }))}
              style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            />
            <button
              type="button"
              onClick={createVendor}
              data-testid="create-vendor-button"
              style={{ width: "100%", background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
            >
              Create vendor
            </button>
          </div>

          {vendors.length > 0 && (
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              style={{ width: "100%", marginBottom: 10, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
            >
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name} · {vendor.service_type} · {vendor.hourly_rate} {vendor.currency}/hr
                </option>
              ))}
            </select>
          )}

          {selectedVendorId && (
            <>
              <div style={{ border: "1px solid var(--border)", padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>Availability</div>
                {availability.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>No availability slots yet.</div>
                )}
                {availability.map((slot) => (
                  <div key={slot.id} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    {DAY_LABELS[slot.day_of_week]}: {slot.start_time} - {slot.end_time}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <select
                    value={availabilityDraft.day_of_week}
                    onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  >
                    {DAY_LABELS.map((label, index) => (
                      <option key={label} value={index.toString()}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={availabilityDraft.start_time}
                    onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, start_time: e.target.value }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  />
                  <input
                    type="time"
                    value={availabilityDraft.end_time}
                    onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, end_time: e.target.value }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addAvailabilitySlot}
                  style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
                >
                  Add availability slot
                </button>
              </div>

              <div style={{ border: "1px solid var(--border)", padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>Book vendor</div>
                <input
                  placeholder="Booking title"
                  value={newBooking.title}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, title: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <input
                  type="datetime-local"
                  value={newBooking.starts_at}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, starts_at: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <input
                  type="datetime-local"
                  value={newBooking.ends_at}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, ends_at: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <input
                  placeholder="Estimated cost"
                  value={newBooking.estimated_cost}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, estimated_cost: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <button
                  type="button"
                  onClick={createBooking}
                  data-testid="create-booking-button"
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
                >
                  Create booking
                </button>
                {recommendationLoading && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>Finding best vendors...</div>
                )}
                {!recommendationLoading && recommendations.length > 0 && (
                  <div style={{ marginTop: 8, border: "1px solid var(--border)", padding: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.08em" }}>
                      RECOMMENDED VENDORS
                    </div>
                    {recommendations.slice(0, 3).map((item) => (
                      <button
                        key={item.vendor.id}
                        type="button"
                        onClick={() => setSelectedVendorId(item.vendor.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          marginBottom: 6,
                          background: item.is_available_for_slot ? "rgba(74,222,128,0.08)" : "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          padding: "6px 8px",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{item.vendor.name}</div>
                        <div style={{ color: "var(--text-muted)" }}>{item.reason}</div>
                        <div style={{ color: "var(--text-muted)" }}>
                          Est. {item.estimated_cost} {item.vendor.currency} · Next: {item.next_open_window ?? "n/a"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  {bookings.map((booking) => (
                    <div key={booking.id} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                      <div style={{ color: "var(--text)" }}>{booking.title}</div>
                      <div>{new Date(booking.starts_at).toLocaleString()} - {new Date(booking.ends_at).toLocaleString()}</div>
                      <div>{booking.status} · {booking.estimated_cost} EUR</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: "1px solid var(--border)", padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>Auto-dispatch by SLA</div>
                <input
                  placeholder="Issue title"
                  value={dispatchDraft.issue_title}
                  onChange={(e) => setDispatchDraft((prev) => ({ ...prev, issue_title: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <input
                  placeholder="Issue description"
                  value={dispatchDraft.issue_description}
                  onChange={(e) => setDispatchDraft((prev) => ({ ...prev, issue_description: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    placeholder="Service type"
                    value={dispatchDraft.service_type}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, service_type: e.target.value }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  />
                  <select
                    value={dispatchDraft.priority}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, priority: e.target.value as "low" | "medium" | "high" | "urgent" }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    placeholder="Duration min"
                    value={dispatchDraft.duration_minutes}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                    style={{ width: 90, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={dispatchDraft.allow_outside_hours}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, allow_outside_hours: e.target.checked }))}
                  />
                  Allow booking outside declared hours (fallback to first match)
                </label>
                <button
                  type="button"
                  onClick={autoDispatch}
                  data-testid="auto-dispatch-button"
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
                >
                  Auto-dispatch now
                </button>
              </div>

              <div style={{ border: "1px solid var(--border)", padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>Contact vendor</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select
                    value={contactDraft.channel}
                    onChange={(e) => setContactDraft((prev) => ({ ...prev, channel: e.target.value as "email" | "call" | "sms" }))}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  >
                    <option value="email">Email</option>
                    <option value="call">Call</option>
                    <option value="sms">SMS</option>
                  </select>
                  <select
                    value={contactDraft.booking_id}
                    onChange={(e) => {
                      const bookingId = e.target.value;
                      const linked = bookings.find((b) => b.id === bookingId);
                      setContactDraft((prev) => ({
                        ...prev,
                        booking_id: bookingId,
                        subject: linked ? `Update on ${linked.title}` : prev.subject,
                        message: linked
                          ? `Hi ${selectedVendor?.name || "team"},\nCan you confirm availability for ${linked.title} on ${new Date(linked.starts_at).toLocaleString()}?\n\nThanks,`
                          : prev.message,
                      }));
                    }}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                  >
                    <option value="">No linked booking</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>{booking.title}</option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="Subject"
                  value={contactDraft.subject}
                  onChange={(e) => setContactDraft((prev) => ({ ...prev, subject: e.target.value }))}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                />
                <textarea
                  placeholder="Message"
                  value={contactDraft.message}
                  onChange={(e) => setContactDraft((prev) => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  style={{ width: "100%", marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={sendCommunication}
                    data-testid="send-vendor-message-button"
                    style={{ flex: 1, background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
                  >
                    Log outbound message
                  </button>
                  {selectedVendor?.contact_email && (
                    <a
                      href={`mailto:${selectedVendor.contact_email}?subject=${encodeURIComponent(contactDraft.subject)}&body=${encodeURIComponent(contactDraft.message)}`}
                      style={{ flex: 1, textAlign: "center", textDecoration: "none", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", fontSize: 11 }}
                    >
                      Open email
                    </a>
                  )}
                </div>
                {selectedVendor?.contact_phone && (
                  <a
                    href={`tel:${selectedVendor.contact_phone}`}
                    style={{ display: "inline-block", marginTop: 6, textDecoration: "none", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", fontSize: 11 }}
                  >
                    Call {selectedVendor.contact_phone}
                  </a>
                )}
                <div style={{ marginTop: 8 }}>
                  {communications.slice(0, 6).map((comm) => (
                    <div key={comm.id} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      <div style={{ color: "var(--text)" }}>{comm.channel.toUpperCase()} · {comm.status}</div>
                      {comm.subject && <div>{comm.subject}</div>}
                      <div style={{ whiteSpace: "pre-wrap" }}>{comm.message}</div>
                      <div>{new Date(comm.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {property.context_md && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 8, letterSpacing: "0.1em" }}>
                RAW MARKDOWN
              </div>
              <pre style={{
                fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {property.context_md}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}