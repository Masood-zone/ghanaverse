"use client"

import { useId, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { cn } from "@/lib/utils"

export function SettingRow({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string
  description: string
  icon: string
  children: (ids: { labelId: string; descriptionId: string }) => ReactNode
  className?: string
}) {
  const id = useId()
  const labelId = `${id}-label`,
    descriptionId = `${id}-description`
  return (
    <Label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 has-[:focus-visible]:bg-muted/50 sm:gap-4 sm:p-5",
        className
      )}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-primary">
        <MaterialSymbol icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block text-sm leading-6 font-semibold">
          {title}
        </span>
        <span
          id={descriptionId}
          className="mt-1 block text-xs leading-6 font-normal text-muted-foreground"
        >
          {description}
        </span>
      </span>
      <span className="mt-0.5 shrink-0">
        {children({ labelId, descriptionId })}
      </span>
    </Label>
  )
}
