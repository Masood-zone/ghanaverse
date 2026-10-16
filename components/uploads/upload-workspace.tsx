"use client"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
const Drawer = dynamic(() => import("./upload-drawer"), { ssr: false })
export function UploadWorkspace() {
  const path = usePathname()
  return path.startsWith("/admin") || path.startsWith("/creator") ? (
    <Drawer />
  ) : null
}
