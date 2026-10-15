"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useRef, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Toaster } from "sonner"
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter(),
    pathname = usePathname(),
    redirecting = useRef(false)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      })
  )
  useEffect(() => {
    redirecting.current = false
    function onAccessError(event: Event) {
      if (
        !(event instanceof CustomEvent) ||
        redirecting.current ||
        pathname.startsWith("/auth")
      )
        return
      const status = event.detail?.status
      if (status !== 401 && !(status === 403 && pathname.startsWith("/admin")))
        return
      redirecting.current = true
      void client.cancelQueries()
      client.clear()
      router.replace(
        status === 401
          ? `/auth?callbackUrl=${encodeURIComponent(pathname)}`
          : "/"
      )
    }
    window.addEventListener("ghanaverse:access-error", onAccessError)
    return () =>
      window.removeEventListener("ghanaverse:access-error", onAccessError)
  }, [client, router, pathname])
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
