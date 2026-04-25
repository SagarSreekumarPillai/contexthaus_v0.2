"use client";
import React, { useState, useRef, useCallback } from "react";
import { api, Property, IngestResult } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

interface Props {
  property: Property;
  onUpdate: (p: Property) => void;
}

const SOURCE_TYPES = ["email", "pdf", "erp", "slack", "other"];

export default function PropertyView({ property, onUpdate }: Props) {
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState("");
  const [lastAttemptFile, setLastAttemptFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceType, setSourceType] = useState("email");
  const [changedSections, setChangedSections] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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

        {/* Raw MD Panel */}
        {property.context_md && (
          <div style={{
            width: 320, borderLeft: "1px solid var(--border)",
            overflowY: "auto", padding: 16,
          }}>
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
  );
}