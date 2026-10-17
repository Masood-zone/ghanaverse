"use client"

import { useId, useState, type ComponentProps } from "react"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const hours = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0")
)
const minutes = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0")
)

export type DateTimePickerProps = Pick<
  ComponentProps<typeof PopoverTrigger>,
  | "id"
  | "ref"
  | "className"
  | "onBlur"
  | "disabled"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
> & {
  value?: string
  onValueChange: (value: string) => void
  required?: boolean
}

// Values are UTC wall-clock strings (YYYY-MM-DDTHH:mm). Calendar dates are
// deliberately formatted without timezone conversion before API serialization.
export function DateTimePicker({
  value,
  onValueChange,
  required,
  className,
  ...props
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const timeId = useId()
  const parsed = value ? parseISO(`${value.slice(0, 10)}T12:00:00`) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  const hour = value?.slice(11, 13) || "00"
  const minute = value?.slice(14, 16) || "00"

  function updateTime(nextHour: string, nextMinute: string) {
    if (selected) {
      onValueChange(
        `${format(selected, "yyyy-MM-dd")}T${nextHour}:${nextMinute}`
      )
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-required={required || undefined}
        {...props}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2 text-left text-sm font-normal shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">
          {selected
            ? `${format(selected, "dd MMM yyyy")}, ${hour}:${minute}`
            : "Pick date and time"}
        </span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-auto p-0"
      >
        <PopoverTitle className="sr-only">
          Choose date and time (UTC)
        </PopoverTitle>
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          autoFocus
          onSelect={(date) => {
            if (date) {
              onValueChange(`${format(date, "yyyy-MM-dd")}T${hour}:${minute}`)
            }
          }}
        />
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">Time (UTC, 24-hour)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${timeId}-hour`}>Hour</Label>
              <SelectField
                id={`${timeId}-hour`}
                value={hour}
                disabled={!selected}
                onValueChange={(next) => updateTime(next, minute)}
              >
                {hours.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${timeId}-minute`}>Minute</Label>
              <SelectField
                id={`${timeId}-minute`}
                value={minute}
                disabled={!selected}
                onValueChange={(next) => updateTime(hour, next)}
              >
                {minutes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
