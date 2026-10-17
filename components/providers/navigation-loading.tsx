"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

type NavigationLoading = {
  register: () => () => void
  startNavigation: (navigate: () => void) => void
}

const NavigationLoadingContext = createContext<NavigationLoading | null>(null)

export function NavigationLoadingProvider({
  children,
}: {
  children: ReactNode
}) {
  const [sources, setSources] = useState<Set<symbol>>(() => new Set())
  const [transitionPending, startTransition] = useTransition()
  const register = useCallback(() => {
    const source = Symbol("navigation")
    setSources((current) => new Set(current).add(source))
    return () => {
      setSources((current) => {
        if (!current.has(source)) return current
        const next = new Set(current)
        next.delete(source)
        return next
      })
    }
  }, [])
  const startNavigation = useCallback(
    (navigate: () => void) => startTransition(navigate),
    [startTransition]
  )
  const value = useMemo(
    () => ({ register, startNavigation }),
    [register, startNavigation]
  )
  const pending = transitionPending || sources.size > 0

  return (
    <NavigationLoadingContext.Provider value={value}>
      {pending ? (
        <div
          className="gv-navigation-loading"
          role="progressbar"
          aria-label="Loading page"
          aria-valuetext="Loading"
        >
          <span className="gv-navigation-loading-track" aria-hidden="true" />
          <span className="sr-only">Loading page…</span>
        </div>
      ) : null}
      {children}
    </NavigationLoadingContext.Provider>
  )
}

/** A source owns its lifetime, so cancelled links and unmounted fallbacks clean up. */
export function useNavigationPending(pending: boolean) {
  const loading = useContext(NavigationLoadingContext)
  useEffect(() => {
    if (pending) return loading?.register()
  }, [loading, pending])
}

export function RoutePending() {
  useNavigationPending(true)
  return null
}

/** Keep router navigations in a shared React transition, including query changes. */
export function useNavigationRouter() {
  const router = useRouter()
  const loading = useContext(NavigationLoadingContext)
  return useMemo(() => {
    const navigate = (action: () => void) => {
      if (loading) loading.startNavigation(action)
      else action()
    }
    return {
      ...router,
      push: (...args: Parameters<typeof router.push>) =>
        navigate(() => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) =>
        navigate(() => router.replace(...args)),
      refresh: () => navigate(() => router.refresh()),
      back: () => navigate(() => router.back()),
      forward: () => navigate(() => router.forward()),
    }
  }, [loading, router])
}
