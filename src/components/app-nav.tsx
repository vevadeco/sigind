"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface AppNavProps {
  current?: "home" | "dashboard" | "analyzer";
}

export default function AppNav({ current }: AppNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm">
      {current !== "home" ? (
        <Link href="/" className="app-link">
          Home
        </Link>
      ) : null}
      {current !== "dashboard" ? (
        <Link href="/dashboard" className="app-link">
          Dashboard
        </Link>
      ) : null}
      {current !== "analyzer" ? (
        <Link href="/analyzer" className="app-link">
          Analyzer
        </Link>
      ) : null}
      <button type="button" onClick={handleLogout} className="app-link">
        Logout
      </button>
    </nav>
  );
}
