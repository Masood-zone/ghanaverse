"use client"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { safeCallbackUrl, profilePickerUrl } from "@/lib/auth/callback"
import { api } from "@/lib/api-client"
import type { ProfilesData } from "@/types/viewer"
import { FormError } from "@/components/admin/shared"
import {
  getAuthFormSchema,
  SIGN_IN_FAILURE_MESSAGE,
  REGISTRATION_FAILURE_MESSAGE,
} from "@/lib/auth/form-validation"
type Values = z.infer<ReturnType<typeof getAuthFormSchema>>
export function AuthForm({
  initialMode,
  callbackUrl,
}: {
  initialMode: "sign-in" | "register"
  callbackUrl: string
}) {
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState("")
  const client = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(getAuthFormSchema(mode)),
    defaultValues: { email: "", password: "", name: "", confirmPassword: "" },
  })
  async function submit(values: Values) {
    setError("")
    if (
      mode === "register" &&
      (!values.name.trim() || values.confirmPassword !== values.password)
    ) {
      form.setError(!values.name.trim() ? "name" : "confirmPassword", {
        message: !values.name.trim()
          ? "Enter your name"
          : "Passwords do not match",
      })
      return
    }
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({
              email: values.email.trim(),
              password: values.password,
            })
          : await authClient.signUp.email({
              name: values.name.trim(),
              email: values.email.trim(),
              password: values.password,
            })
      if (result.error) {
        setError(
          mode === "sign-in"
            ? SIGN_IN_FAILURE_MESSAGE
            : REGISTRATION_FAILURE_MESSAGE
        )
        return
      }
      const session = await authClient.getSession({
        query: { disableCookieCache: true },
      })
      if (!session.data?.user) {
        setError(
          mode === "register"
            ? "Your account was created, but sign-in could not finish. Sign in below to continue."
            : "Sign-in could not finish. Please try again."
        )
        setMode("sign-in")
        return
      }
      await client.cancelQueries()
      client.clear()
      const profiles = await api<ProfilesData>("/profiles")
      if (mode === "register")
        sessionStorage.setItem("ghanaverse.welcome", session.data.user.name)
      const destination = safeCallbackUrl(callbackUrl)
      window.location.replace(
        profiles.profiles.length > 1
          ? profilePickerUrl(destination)
          : destination
      )
    } catch {
      setError(
        "We could not finish opening your account. Try signing in to continue; your original destination is preserved."
      )
      setMode("sign-in")
    }
  }
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-extrabold">
        {mode === "sign-in" ? "Welcome back" : "Join GhanaVerse"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your home for Ghanaian stories.
      </p>
      <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(submit)}>
        {mode === "register" ? (
          <label className="gv-label">
            Full name
            <input
              className="gv-field"
              autoComplete="name"
              {...form.register("name")}
            />
            <FormError message={form.formState.errors.name?.message} />
          </label>
        ) : null}
        <label className="gv-label">
          Email address
          <input
            type="email"
            className="gv-field"
            autoComplete="email"
            {...form.register("email")}
          />
          <FormError message={form.formState.errors.email?.message} />
        </label>
        <label className="gv-label">
          Password
          <input
            type="password"
            className="gv-field"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            {...form.register("password")}
          />
          <FormError message={form.formState.errors.password?.message} />
        </label>
        {mode === "register" ? (
          <label className="gv-label">
            Confirm password
            <input
              type="password"
              className="gv-field"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            <FormError
              message={form.formState.errors.confirmPassword?.message}
            />
          </label>
        ) : null}
        <FormError message={error} />
        <button
          className="gv-action w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Please wait…"
            : mode === "sign-in"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
      <button
        className="mt-5 text-sm font-semibold text-primary"
        onClick={() => {
          setMode(mode === "sign-in" ? "register" : "sign-in")
          setError("")
          form.clearErrors()
        }}
      >
        {mode === "sign-in"
          ? "New here? Create an account"
          : "Already registered? Sign in"}
      </button>
    </div>
  )
}
