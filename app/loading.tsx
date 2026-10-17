import { RouteSkeleton } from "@/components/common/route-skeleton"
import { ViewerShell } from "@/components/layout/viewer-shell"
export default function Loading() {
  return (
    <ViewerShell>
      <RouteSkeleton kind="home" />
    </ViewerShell>
  )
}
