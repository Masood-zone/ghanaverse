"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { authContinuationUrl } from "@/lib/auth/callback"
import { FormError } from "@/components/admin/shared"
import Link from "@/components/common/app-link"
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
      await client.cancelQueries()
      client.clear()
      if (mode === "register")
        sessionStorage.setItem("ghanaverse.welcome", result.data.user.name)
      window.location.replace(authContinuationUrl(callbackUrl))
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
          <Label className="gv-label">
            Full name
            <Input autoComplete="name" {...form.register("name")} />
            <FormError message={form.formState.errors.name?.message} />
          </Label>
        ) : null}
        <Label className="gv-label">
          Email address
          <Input
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
          <FormError message={form.formState.errors.email?.message} />
        </Label>
        <Label className="gv-label">
          Password
          <Input
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            {...form.register("password")}
          />
          <FormError message={form.formState.errors.password?.message} />
        </Label>
        {mode === "register" ? (
          <Label className="gv-label">
            Confirm password
            <Input
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            <FormError
              message={form.formState.errors.confirmPassword?.message}
            />
          </Label>
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
      {mode === "sign-in" ? <Link href="/auth/recovery" className="mt-5 block text-sm font-semibold text-primary">Forgot your password?</Link> : null}
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
