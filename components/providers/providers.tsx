"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useNavigationRouter as useRouter } from "@/components/providers/navigation-loading"
import { Toaster, toast } from "sonner"
import { PROFILE_CHANGED_EVENT } from "@/lib/viewer-events"
import { SIGNING_OUT_KEY } from "@/components/auth/use-sign-out"
import { UploadWorkspace } from "@/components/uploads/upload-workspace"
import { authClient } from "@/lib/auth-client"
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter(),
    pathname = usePathname(),
    redirecting = useRef(false)
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession()
  const previousUserId = useRef<string | null | undefined>(undefined)
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
    if (isPending || sessionError) return
    const userId = session?.user.id ?? null
    const previous = previousUserId.current
    previousUserId.current = userId
    if (previous === undefined || previous === userId) return
    // Better Auth synchronizes sign-out between tabs; only domain caches need clearing.
    void client.cancelQueries().then(() => {
      client.clear()
      if (
        !sessionStorage.getItem(SIGNING_OUT_KEY) &&
        !window.location.pathname.startsWith("/auth")
      )
        window.location.reload()
    })
  }, [client, isPending, sessionError, session?.user.id])
  useEffect(() => {
    sessionStorage.removeItem(SIGNING_OUT_KEY)
    const welcome = sessionStorage.getItem("ghanaverse.welcome")
    if (welcome) {
      sessionStorage.removeItem("ghanaverse.welcome")
      toast.success(`Welcome to GhanaVerse, ${welcome}!`)
    }
    const notice = sessionStorage.getItem("ghanaverse.notice")
    if (notice) {
      sessionStorage.removeItem("ghanaverse.notice")
      toast.success(notice)
    }
    function onProfileStorage(event: StorageEvent) {
      if (event.key !== PROFILE_CHANGED_EVENT) return
      window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT))
      void client.cancelQueries().then(() => {
        client.clear()
        window.location.reload()
      })
    }
    window.addEventListener("storage", onProfileStorage)
    return () => window.removeEventListener("storage", onProfileStorage)
  }, [client])
  useEffect(() => {
    redirecting.current = false
    function onAccessError(event: Event) {
      if (
        !(event instanceof CustomEvent) ||
        redirecting.current ||
        sessionStorage.getItem(SIGNING_OUT_KEY) ||
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
          ? `/auth?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
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
      <UploadWorkspace />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
