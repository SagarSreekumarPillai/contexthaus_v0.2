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
  /** Auditor / contractor: no ingest or vendor mutations (API also enforces). */
  readOnly?: boolean;
}

const SOURCE_TYPES = ["email", "pdf", "erp", "slack", "other"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PropertyView({ property, onUpdate, readOnly = false }: Props) {
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
    if (readOnly) {
      Promise.resolve().then(() => setRecommendations([]));
      return;
    }
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
  }, [newBooking.starts_at, newBooking.ends_at, selectedVendorId, vendors, property.id, readOnly]);

  const createVendor = async () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
  }, [property.id, sourceType, onUpdate, readOnly]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) ingest(file);
  }, [ingest, readOnly]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
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
      const bulletMatch = line.match(/^(\s*)- (.*)/);
      const isBullet = bulletMatch !== null;
      const isSeparator = line === "---";

      const sectionName = isH2 ? line.replace("## ", "") : null;
      const isChanged = sectionName && changedSections.includes(sectionName);

      if (isH1) return (
        <div key={i} className="ch-pv-md-h1">
          {renderInline(line.replace("# ", ""))}
        </div>
      );
      if (isH2) {
        const h2Cls = `ch-pv-md-h2${isChanged ? " is-changed diff-flash" : ""}`;
        return (
          <div key={i} className={h2Cls}>
            {line.replace("## ", "").toUpperCase()}
          </div>
        );
      }
      if (isH3) return (
        <div key={i} className="ch-pv-md-h3">
          {renderInline(line.replace("### ", ""))}
        </div>
      );
      if (isBullet && bulletMatch) return (
        <div
          key={i}
          className="ch-pv-md-bullet"
          style={{ paddingLeft: 16 + bulletMatch[1].length * 8 }}
        >
          <span className="ch-pv-md-bullet-mark">→ </span>
          {renderInline(bulletMatch[2])}
        </div>
      );
      if (isSeparator) return <div key={i} className="ch-pv-md-sep" />;
      if (!line.trim()) return <div key={i} className="ch-pv-md-spacer" aria-hidden />;
      return (
        <div key={i} className="ch-pv-md-p">
          {renderInline(line)}
        </div>
      );
    });
  };

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;

  return (
    <div className="ch-pv-root" data-testid="property-view-root">
      <header className="ch-pv-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 className="ch-pv-title" data-testid="selected-property-title">
            {property.name}
          </h2>
          <p className="ch-pv-address">{property.address}</p>
        </div>
        <div className="ch-pv-toolbar">
          {!readOnly ? (
            <>
              <select
                className="ch-pv-select"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                aria-label="Source type for ingest"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ch-btn ch-btn-primary ch-btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={ingesting}
                data-testid="ingest-file-button"
              >
                {ingesting ? "Processing…" : "Ingest file"}
              </button>
              <input
                ref={fileRef}
                type="file"
                style={{ display: "none" }}
                onChange={onFileChange}
                data-testid="ingest-file-input"
                accept=".txt,.pdf,.eml,.md,.csv,.json"
              />
            </>
          ) : (
            <span className="ch-pv-muted">Read-only workspace</span>
          )}
        </div>
      </header>

      {!readOnly && ingestError && (
        <div className="ch-pv-alert ch-pv-alert--error fade-in" role="alert">
          <span data-testid="ingest-error-message">{ingestError}</span>
          {lastAttemptFile && (
            <button
              type="button"
              className="ch-btn ch-btn-ghost ch-btn-sm"
              onClick={() => {
                trackEvent("ingest_retry_clicked", { propertyId: property.id, sourceType });
                ingest(lastAttemptFile);
              }}
              data-testid="retry-ingest-button"
              style={{ borderColor: "var(--ch-danger)", color: "var(--ch-danger)" }}
            >
              Retry ingest
            </button>
          )}
        </div>
      )}
      {!readOnly && lastResult && (
        <div
          className={`ch-pv-alert fade-in ${lastResult.status === "ignored" ? "ch-pv-alert--error" : "ch-pv-alert--success"}`}
          role="status"
        >
          <span>
            {lastResult.status === "ignored"
              ? `⊘ IGNORED — ${lastResult.reason}`
              : `✓ INGESTED — ${lastResult.filename}`}
          </span>
          {lastResult.status === "ingested" && lastResult.changes.length > 0 && (
            <span style={{ color: "var(--ch-accent)", fontWeight: 500 }}>
              ↺ UPDATED: {lastResult.changes.map((c) => c.section).join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="ch-pv-body">
        <div
          className={`ch-pv-main${dragOver && !readOnly ? " ch-pv-main--drag" : ""}`}
          data-testid="property-workspace-main"
          onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={readOnly ? undefined : () => setDragOver(false)}
          onDrop={readOnly ? undefined : onDrop}
        >
          {property.context_md ? (
            <article className="ch-pv-prose">{renderMarkdown(property.context_md)}</article>
          ) : (
            <div className="ch-pv-empty">
              <div className="ch-pv-empty-icon" aria-hidden>
                ↑
              </div>
              <div className="ch-pv-empty-title">Drop a file to build context</div>
              <p className="ch-pv-empty-hint">
                Email (.eml, .txt), PDF, Slack export, ERP CSV, Markdown, or JSON — we route by source type above.
              </p>
            </div>
          )}
        </div>

        <aside className="ch-pv-rail" aria-label="Vendors and bookings">
          <div className="ch-pv-rail-title">Vendors &amp; operations</div>
          {vendorError ? <div className="ch-error" style={{ marginBottom: 0 }}>{vendorError}</div> : null}
          {vendorLoading ? (
            <div className="ch-pv-panel" aria-busy="true">
              <div className="ch-pv-panel-title">Loading</div>
              <div className="skeleton shimmer" style={{ height: 12, width: "70%" }} />
              <div className="skeleton shimmer" style={{ height: 12, width: "45%", marginTop: 10 }} />
              <div className="skeleton shimmer" style={{ height: 12, width: "55%", marginTop: 10 }} />
            </div>
          ) : null}

          {!readOnly && !vendorLoading && (
            <div className="ch-pv-panel">
              <div className="ch-pv-panel-title">Add vendor</div>
              <input
                className="ch-pv-field"
                placeholder="Vendor name"
                value={newVendor.name}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="ch-pv-field"
                placeholder="Service type (e.g. roofing)"
                value={newVendor.service_type}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, service_type: e.target.value }))}
              />
              <input
                className="ch-pv-field"
                placeholder="Email"
                value={newVendor.contact_email}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, contact_email: e.target.value }))}
              />
              <input
                className="ch-pv-field"
                placeholder="Phone"
                value={newVendor.contact_phone}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, contact_phone: e.target.value }))}
              />
              <input
                className="ch-pv-field"
                placeholder="Hourly rate"
                value={newVendor.hourly_rate}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, hourly_rate: e.target.value }))}
              />
              <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm ch-pv-btn-block" onClick={createVendor} data-testid="create-vendor-button">
                Create vendor
              </button>
            </div>
          )}

          {vendors.length > 0 && (
            <label className="ch-pv-muted" style={{ display: "block", marginBottom: 4 }}>
              Active vendor
              <select className="ch-pv-vendor-pill" value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} aria-label="Select vendor">
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} · {vendor.service_type} · {vendor.hourly_rate} {vendor.currency}/hr
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedVendorId && (
            <>
              <div className="ch-pv-panel">
                <div className="ch-pv-panel-title">Availability</div>
                {availability.length === 0 ? (
                  <p className="ch-pv-muted" style={{ marginBottom: 10 }}>
                    No slots yet — add windows when this vendor can be booked.
                  </p>
                ) : null}
                {availability.map((slot) => (
                  <div key={slot.id} className="ch-pv-muted" style={{ marginBottom: 6 }}>
                    {DAY_LABELS[slot.day_of_week]} · {slot.start_time}–{slot.end_time}
                  </div>
                ))}
                {!readOnly && (
                  <div className="ch-pv-flex" style={{ marginTop: 10 }}>
                    <select
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      value={availabilityDraft.day_of_week}
                      onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    >
                      {DAY_LABELS.map((label, index) => (
                        <option key={label} value={index.toString()}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      type="time"
                      value={availabilityDraft.start_time}
                      onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, start_time: e.target.value }))}
                    />
                    <input
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      type="time"
                      value={availabilityDraft.end_time}
                      onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                )}
                {!readOnly && (
                  <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm ch-pv-btn-block" onClick={addAvailabilitySlot}>
                    Add availability slot
                  </button>
                )}
              </div>

              <div className="ch-pv-panel">
                <div className="ch-pv-panel-title">Book vendor</div>
                {!readOnly && (
                  <>
                    <input
                      className="ch-pv-field"
                      placeholder="Booking title"
                      value={newBooking.title}
                      onChange={(e) => setNewBooking((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <input
                      className="ch-pv-field"
                      type="datetime-local"
                      value={newBooking.starts_at}
                      onChange={(e) => setNewBooking((prev) => ({ ...prev, starts_at: e.target.value }))}
                    />
                    <input
                      className="ch-pv-field"
                      type="datetime-local"
                      value={newBooking.ends_at}
                      onChange={(e) => setNewBooking((prev) => ({ ...prev, ends_at: e.target.value }))}
                    />
                    <input
                      className="ch-pv-field"
                      placeholder="Estimated cost"
                      value={newBooking.estimated_cost}
                      onChange={(e) => setNewBooking((prev) => ({ ...prev, estimated_cost: e.target.value }))}
                    />
                    <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm ch-pv-btn-block" onClick={createBooking} data-testid="create-booking-button">
                      Create booking
                    </button>
                  </>
                )}
                {recommendationLoading ? (
                  <div className="ch-pv-muted" style={{ marginTop: 10 }}>
                    <span className="skeleton shimmer" style={{ display: "inline-block", height: 10, width: 140 }} />
                  </div>
                ) : null}
                {!recommendationLoading && recommendations.length > 0 && (
                  <div className="ch-pv-reco">
                    <div className="ch-pv-reco-title">Recommended</div>
                    {recommendations.slice(0, 3).map((item) => (
                      <button
                        key={item.vendor.id}
                        type="button"
                        className={`ch-pv-reco-btn${item.is_available_for_slot ? " is-available" : ""}`}
                        onClick={() => setSelectedVendorId(item.vendor.id)}
                      >
                        <div style={{ fontWeight: 600 }}>{item.vendor.name}</div>
                        <div className="ch-pv-muted" style={{ marginTop: 4 }}>
                          {item.reason}
                        </div>
                        <div className="ch-pv-muted" style={{ marginTop: 4 }}>
                          Est. {item.estimated_cost} {item.vendor.currency} · Next: {item.next_open_window ?? "n/a"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  {bookings.map((booking) => (
                    <div key={booking.id} className="ch-pv-booking-row">
                      <div className="ch-pv-booking-title">{booking.title}</div>
                      <div>
                        {new Date(booking.starts_at).toLocaleString()} — {new Date(booking.ends_at).toLocaleString()}
                      </div>
                      <div>
                        {booking.status} · {booking.estimated_cost} EUR
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!readOnly && (
                <div className="ch-pv-panel">
                  <div className="ch-pv-panel-title">Auto-dispatch</div>
                  <input
                    className="ch-pv-field"
                    placeholder="Issue title"
                    value={dispatchDraft.issue_title}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, issue_title: e.target.value }))}
                  />
                  <input
                    className="ch-pv-field"
                    placeholder="Issue description"
                    value={dispatchDraft.issue_description}
                    onChange={(e) => setDispatchDraft((prev) => ({ ...prev, issue_description: e.target.value }))}
                  />
                  <div className="ch-pv-flex" style={{ marginBottom: 8 }}>
                    <input
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      placeholder="Service type"
                      value={dispatchDraft.service_type}
                      onChange={(e) => setDispatchDraft((prev) => ({ ...prev, service_type: e.target.value }))}
                    />
                    <select
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      value={dispatchDraft.priority}
                      onChange={(e) =>
                        setDispatchDraft((prev) => ({ ...prev, priority: e.target.value as "low" | "medium" | "high" | "urgent" }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <input
                      className="ch-pv-field"
                      style={{ marginBottom: 0, maxWidth: 100, flex: "0 0 auto" }}
                      placeholder="Min"
                      value={dispatchDraft.duration_minutes}
                      onChange={(e) => setDispatchDraft((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                    />
                  </div>
                  <label className="ch-pv-muted" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={dispatchDraft.allow_outside_hours}
                      onChange={(e) => setDispatchDraft((prev) => ({ ...prev, allow_outside_hours: e.target.checked }))}
                    />
                    Allow outside declared hours
                  </label>
                  <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm ch-pv-btn-block" onClick={autoDispatch} data-testid="auto-dispatch-button">
                    Auto-dispatch now
                  </button>
                </div>
              )}

              <div className="ch-pv-panel">
                <div className="ch-pv-panel-title">Contact</div>
                {!readOnly && (
                  <div className="ch-pv-flex" style={{ marginBottom: 8 }}>
                    <select
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
                      value={contactDraft.channel}
                      onChange={(e) => setContactDraft((prev) => ({ ...prev, channel: e.target.value as "email" | "call" | "sms" }))}
                    >
                      <option value="email">Email</option>
                      <option value="call">Call</option>
                      <option value="sms">SMS</option>
                    </select>
                    <select
                      className="ch-pv-field"
                      style={{ marginBottom: 0 }}
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
                    >
                      <option value="">No linked booking</option>
                      {bookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!readOnly && (
                  <>
                    <input
                      className="ch-pv-field"
                      placeholder="Subject"
                      value={contactDraft.subject}
                      onChange={(e) => setContactDraft((prev) => ({ ...prev, subject: e.target.value }))}
                    />
                    <textarea
                      className="ch-pv-field"
                      placeholder="Message"
                      value={contactDraft.message}
                      onChange={(e) => setContactDraft((prev) => ({ ...prev, message: e.target.value }))}
                      rows={4}
                    />
                    <div className="ch-pv-flex">
                      <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm" onClick={sendCommunication} data-testid="send-vendor-message-button">
                        Log message
                      </button>
                      {selectedVendor?.contact_email ? (
                        <a
                          className="ch-pv-link-btn"
                          href={`mailto:${selectedVendor.contact_email}?subject=${encodeURIComponent(contactDraft.subject)}&body=${encodeURIComponent(contactDraft.message)}`}
                        >
                          Open email
                        </a>
                      ) : null}
                    </div>
                  </>
                )}
                {selectedVendor?.contact_phone ? (
                  <a className="ch-pv-link-btn" style={{ display: "inline-block", marginTop: 10, maxWidth: "100%" }} href={`tel:${selectedVendor.contact_phone}`}>
                    Call {selectedVendor.contact_phone}
                  </a>
                ) : null}
                <div style={{ marginTop: 12 }}>
                  {communications.slice(0, 6).map((comm) => (
                    <div key={comm.id} className="ch-pv-comm">
                      <div className="ch-pv-comm-sub">
                        {comm.channel.toUpperCase()} · {comm.status}
                      </div>
                      {comm.subject ? <div>{comm.subject}</div> : null}
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{comm.message}</div>
                      <div className="ch-pv-muted" style={{ marginTop: 6 }}>
                        {new Date(comm.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {property.context_md ? (
            <div className="ch-pv-raw">
              <div className="ch-pv-raw-label">Source markdown</div>
              <pre className="ch-pv-raw-pre">{property.context_md}</pre>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}