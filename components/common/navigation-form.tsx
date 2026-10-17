"use client"

import Form from "next/form"
import { useFormStatus } from "react-dom"
import type { ComponentProps } from "react"
import { useNavigationPending } from "@/components/providers/navigation-loading"

function FormPending() {
  const { pending } = useFormStatus()
  useNavigationPending(pending)
  return <span hidden data-navigation-pending={pending} />
}

export function NavigationForm({
  children,
  ...props
}: ComponentProps<typeof Form>) {
  return (
    <Form {...props}>
      {children}
      <FormPending />
    </Form>
  )
}
