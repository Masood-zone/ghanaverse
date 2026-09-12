import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { ViewerNavigation } from "@/components/layout/viewer-navigation";
export function ViewerShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen"><header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 md:px-6"><Brand /><ViewerNavigation /></div></header><main>{children}</main><footer className="mt-16 border-t bg-card"><div className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted-foreground md:px-6">© 2026 GhanaVerse. Ghanaian stories, thoughtfully framed.</div></footer></div>;
}
