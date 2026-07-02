"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setError("Invalid username or password");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-[0.25em] text-terminal-lime-bright">Secure Access</p>
      <h1 className="mt-2 text-3xl font-bold text-terminal-lime">MEXC Scanner Login</h1>
      <p className="app-muted mt-2 text-sm">Sign in with your username and password.</p>
      <form onSubmit={handleSubmit} className="app-panel mt-8 space-y-4 p-6">
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          className="app-input"
          autoComplete="username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="app-input"
          autoComplete="current-password"
          required
        />
        {error ? <p className="app-error text-sm">{error}</p> : null}
        <button type="submit" disabled={loading} className="app-btn-primary w-full py-3">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
