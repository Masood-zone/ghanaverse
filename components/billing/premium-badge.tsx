import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { cn } from "@/lib/utils"

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-extrabold tracking-wide text-amber-950",
        className
      )}
    >
      <MaterialSymbol icon="workspace_premium" className="text-sm" />
      Premium
    </span>
  )
}
