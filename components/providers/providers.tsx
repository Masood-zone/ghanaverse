"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"
export function Providers({children}:{children:ReactNode}) {
 const [client] = useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1,refetchOnWindowFocus:false},mutations:{retry:false}}}))
 return <QueryClientProvider client={client}>{children}<Toaster position="top-center" richColors /></QueryClientProvider>
}
