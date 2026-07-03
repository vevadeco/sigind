"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ManualScanButtonProps {
  compact?: boolean;
}

export default function ManualScanButton({ compact = false }: ManualScanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleScan() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Scan failed.");
        return;
      }

      setMessage(payload.message ?? "Scan complete.");
      router.refresh();
    } catch {
      setError("Scan failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col gap-2" : "mb-6 flex flex-col gap-2"}>
      <button
        type="button"
        onClick={handleScan}
        disabled={loading}
        className="app-btn-primary px-4 py-2 disabled:opacity-60"
      >
        {loading ? "Scanning..." : "Run Scan Now"}
      </button>
      {message ? <p className="text-sm text-terminal-lime-bright">{message}</p> : null}
      {error ? <p className="app-error text-sm">{error}</p> : null}
    </div>
  );
}
