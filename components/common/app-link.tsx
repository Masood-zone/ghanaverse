"use client"

import Link, { useLinkStatus } from "next/link"
import type { ComponentProps } from "react"
import { useNavigationPending } from "@/components/providers/navigation-loading"

function LinkPending() {
  const { pending } = useLinkStatus()
  useNavigationPending(pending)
  return (
    <span
      aria-hidden="true"
      className={pending ? "gv-link-pending" : "hidden"}
      data-navigation-pending={pending}
    />
  )
}

export default function AppLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  )
}
