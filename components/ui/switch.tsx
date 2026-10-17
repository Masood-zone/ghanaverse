"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      render={<button type="button" />}
      nativeButton
      data-slot="switch"
      className={cn(
        "group relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent bg-slate-300 shadow-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 translate-x-0 rounded-full bg-white shadow-sm transition-transform group-data-checked:translate-x-5 motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  )
}
