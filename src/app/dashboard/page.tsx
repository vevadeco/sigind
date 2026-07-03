import Link from "next/link";
import AppNav from "@/components/app-nav";
import ManualScanButton from "@/components/manual-scan-button";
import { queryForDashboard } from "@/lib/db/signals";

interface DashboardPageProps {
  searchParams?: {
    symbol?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const page = Number(searchParams?.page ?? "1");
  const pageSize = Number(searchParams?.pageSize ?? "20");
  const symbolFilter = searchParams?.symbol ?? "";

  let error = false;
  let result = {
    items: [] as Awaited<ReturnType<typeof queryForDashboard>>["items"],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  };

  try {
    result = await queryForDashboard({ page, pageSize, symbolFilter });
  } catch (err) {
    console.error("[dashboard] Query failed", err);
    error = true;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-terminal-lime">Signal Dashboard</h1>
          <p className="app-muted mt-1 text-sm">Signals from the last 7 days (Neon PostgreSQL)</p>
        </div>
        <AppNav current="dashboard" />
      </header>

      <ManualScanButton />

      <form method="get" action="/dashboard" className="mb-6 flex flex-wrap gap-3">
        <input
          name="symbol"
          defaultValue={symbolFilter}
          placeholder="Filter by symbol"
          className="app-input max-w-xs py-2"
        />
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        <button type="submit" className="app-btn-primary px-4 py-2">
          Filter
        </button>
      </form>

      {error ? (
        <div className="app-panel border-red-500/40 p-4">
          <p className="font-medium text-red-400">Could not load signals from Neon.</p>
          <a href="/dashboard" className="mt-2 inline-block text-sm text-terminal-lime underline">
            Retry
          </a>
        </div>
      ) : null}

      {!error && result.items.length === 0 ? (
        <div className="app-panel p-8 text-center app-muted">
          No signals available for the current filter.
        </div>
      ) : null}

      {!error && result.items.length > 0 ? (
        <div className="app-panel overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-terminal-bg/80">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Entry</th>
                <th className="px-4 py-3">TP</th>
                <th className="px-4 py-3">SL</th>
                <th className="px-4 py-3">Patterns</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Suppressed</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((signal) => (
                <tr key={signal.id} className="border-t border-terminal-border">
                  <td className="px-4 py-3 font-medium">{signal.symbol}</td>
                  <td className="px-4 py-3">{signal.direction}</td>
                  <td className="px-4 py-3">{signal.entryPrice.toFixed(4)}</td>
                  <td className="px-4 py-3">{signal.takeProfit.toFixed(4)}</td>
                  <td className="px-4 py-3">{signal.stopLoss.toFixed(4)}</td>
                  <td className="px-4 py-3">{signal.patterns.join(", ")}</td>
                  <td className="px-4 py-3">{signal.score.toFixed(1)}</td>
                  <td className="px-4 py-3">{signal.timestamp.toISOString()}</td>
                  <td className="px-4 py-3">{signal.suppressed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!error && result.totalPages > 1 ? (
        <div className="mt-6 flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard?symbol=${encodeURIComponent(symbolFilter)}&page=${page - 1}&pageSize=${pageSize}`}
              className="app-link px-3 py-2"
            >
              Previous
            </Link>
          ) : null}
          <span className="app-muted">
            Page {result.page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link
              href={`/dashboard?symbol=${encodeURIComponent(symbolFilter)}&page=${page + 1}&pageSize=${pageSize}`}
              className="app-link px-3 py-2"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
