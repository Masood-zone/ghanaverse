import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
export function MaterialSymbol({
  icon,
  filled,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { icon: string; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "material-symbols-outlined leading-none select-none",
        filled && "filled",
        className
      )}
      {...props}
    >
      {icon}
    </span>
  )
}
