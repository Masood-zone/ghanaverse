"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "@/lib/utils"

export const RadioGroup = RadioGroupPrimitive

export function RadioGroupItem({
  className,
  ...props
}: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      render={<button type="button" />}
      nativeButton
      data-slot="radio-group-item"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-input bg-card text-primary shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-current" />
    </RadioPrimitive.Root>
  )
}
