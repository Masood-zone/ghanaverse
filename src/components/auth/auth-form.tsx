"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  getRegistrationValidationError,
  REGISTRATION_FAILURE_MESSAGE,
  SIGN_IN_FAILURE_MESSAGE,
} from "@/lib/auth/form-validation";

export function AuthForm({ initialMode, callbackUrl }: { initialMode: "sign-in" | "register"; callbackUrl: string }) {
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    if (mode === "register") {
      const validationError = getRegistrationValidationError(password, String(formData.get("confirmPassword")));
      if (validationError) { setError(validationError); setPending(false); return; }
    }
    const result = mode === "sign-in"
      ? await authClient.signIn.email({ email, password, callbackURL: callbackUrl })
      : await authClient.signUp.email({ name: String(formData.get("name")), email, password, callbackURL: callbackUrl });
    setPending(false);
    if (result.error) { setError(mode === "sign-in" ? SIGN_IN_FAILURE_MESSAGE : REGISTRATION_FAILURE_MESSAGE); return; }
    router.push(callbackUrl);
    router.refresh();
  }

  function selectMode(nextMode: "sign-in" | "register") { setMode(nextMode); setError(undefined); }

  return <div className="w-full max-w-md">
    <div className="mb-8 inline-flex w-full rounded-lg bg-muted p-1" role="tablist" aria-label="Authentication mode">
      <button type="button" onClick={() => selectMode("sign-in")} aria-selected={mode === "sign-in"} className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold ${mode === "sign-in" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Sign In</button>
      <button type="button" onClick={() => selectMode("register")} aria-selected={mode === "register"} className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Create Account</button>
    </div>
    <h1 className="text-3xl font-extrabold tracking-tight">{mode === "sign-in" ? "Welcome back" : "Join GhanaVerse"}</h1>
    <p className="mt-2 leading-6 text-muted-foreground">{mode === "sign-in" ? "Sign in to continue your GhanaVerse journey." : "Create your viewer account in a few seconds."}</p>
    <form action={submit} className="mt-8 space-y-4">
      {mode === "register" && <label className="block text-sm font-semibold">Full name<Input className="mt-1.5" name="name" required autoComplete="name" /></label>}
      <label className="block text-sm font-semibold">Email address<Input className="mt-1.5" name="email" required type="email" autoComplete="email" /></label>
      <label className="block text-sm font-semibold">Password<Input className="mt-1.5" name="password" required type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
      {mode === "register" && <label className="block text-sm font-semibold">Confirm password<Input className="mt-1.5" name="confirmPassword" required type="password" minLength={8} autoComplete="new-password" /></label>}
      {error && <p role="alert" className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Please wait..." : mode === "sign-in" ? "Sign In to GhanaVerse" : "Create Account"}</Button>
    </form>
  </div>;
}
