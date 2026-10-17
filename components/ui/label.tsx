import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm leading-5 font-medium has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        className
      )}
      {...props}
    />
  )
}
