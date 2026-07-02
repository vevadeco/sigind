import Link from "next/link";
import AppNav from "@/components/app-nav";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-terminal-lime-bright">MEXC Futures</p>
          <h1 className="mt-3 text-5xl font-bold text-terminal-lime">Trading Scanner</h1>
        </div>
        <AppNav current="home" />
      </header>
      <p className="app-muted max-w-2xl text-lg">
        Automated futures signal scanning with pattern detection, confluence scoring, Telegram
        alerts, and a manual chart analyzer powered by Claude Vision. Data is stored in Neon
        PostgreSQL.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/dashboard" className="app-btn-primary px-5 py-3">
          Open Dashboard
        </Link>
        <Link href="/analyzer" className="app-link px-5 py-3">
          Chart Analyzer
        </Link>
      </div>
    </main>
  );
}
