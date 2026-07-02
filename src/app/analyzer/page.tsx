"use client";

import { ClipboardEvent, FormEvent, useMemo, useState } from "react";
import AppNav from "@/components/app-nav";
import type { AnalysisResponse } from "@/lib/types";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function AnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [entryPrice, setEntryPrice] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const levelsValid = useMemo(() => {
    const values = [entryPrice, takeProfit, stopLoss].map(Number);
    return values.every((value) => Number.isFinite(value) && value > 0);
  }, [entryPrice, takeProfit, stopLoss]);

  const canSubmit = Boolean(file) && levelsValid && !loading;

  function validateFile(nextFile: File): string | null {
    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      return "Unsupported file type. Use PNG, JPEG, or WEBP.";
    }
    if (nextFile.size > MAX_BYTES) {
      return "Image exceeds the 5 MB limit.";
    }
    return null;
  }

  function handleFileChange(nextFile: File | null) {
    if (!nextFile) return;
    const validationError = validateFile(nextFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError("");
    setFile(nextFile);
    setResult(null);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith("image/")
    );
    if (!item) return;
    const pasted = item.getAsFile();
    if (pasted) handleFileChange(pasted);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !canSubmit) return;

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("imageType", file.type);
    formData.append("entryPrice", entryPrice);
    formData.append("takeProfit", takeProfit);
    formData.append("stopLoss", stopLoss);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Analysis could not be completed.");
      return;
    }

    setResult(payload as AnalysisResponse);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-terminal-lime">Chart Analyzer</h1>
          <p className="app-muted mt-1 text-sm">
            Upload a chart screenshot with proposed trade levels for AI review.
          </p>
        </div>
        <AppNav current="analyzer" />
      </header>

      <p className="app-panel mb-6 border-terminal-lime/40 p-4 text-sm text-terminal-muted">
        This analysis is automated, not financial advice, and limited to what is visible in the
        screenshot.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          onPaste={handlePaste}
          className="app-panel border-dashed p-6"
        >
          <label className="block text-sm font-medium text-terminal-lime-bright">
            Chart image (upload or paste)
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-3 block w-full text-sm text-terminal-lime"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
          {file ? <p className="app-muted mt-2 text-sm">{file.name}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Entry price"
            value={entryPrice}
            onChange={(event) => setEntryPrice(event.target.value)}
            className="app-input"
          />
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Take profit"
            value={takeProfit}
            onChange={(event) => setTakeProfit(event.target.value)}
            className="app-input"
          />
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Stop loss"
            value={stopLoss}
            onChange={(event) => setStopLoss(event.target.value)}
            className="app-input"
          />
        </div>

        {error ? <p className="app-error text-sm">{error}</p> : null}

        <button type="submit" disabled={!canSubmit} className="app-btn-primary px-5 py-3">
          {loading ? "Analyzing..." : "Analyze Chart"}
        </button>
      </form>

      {result ? (
        <section className="mt-10 space-y-6">
          <AnalysisSection title="Patterns" content={result.patterns} />
          <AnalysisSection title="Trend Assessment" content={result.trendAssessment} />
          <AnalysisSection title="Trade Evaluation" content={result.tradeEvaluation} />
          <AnalysisSection title="Summary" content={result.summary} />
        </section>
      ) : null}
    </main>
  );
}

function AnalysisSection({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <div className="app-panel p-5">
      <h2 className="text-lg font-semibold text-terminal-lime-bright">{title}</h2>
      <p className="app-muted mt-3 whitespace-pre-wrap text-sm leading-6">{content}</p>
    </div>
  );
}
