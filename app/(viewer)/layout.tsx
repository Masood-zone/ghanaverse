import type { ReactNode } from "react";
import { ViewerShell } from "@/components/layout/viewer-shell";
export default function ViewerLayout({ children }: { children: ReactNode }) { return <ViewerShell>{children}</ViewerShell>; }
