import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-24">Loading...</main>}>
      <LoginForm />
    </Suspense>
  );
}
