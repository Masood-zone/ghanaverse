"use client"

import { Play, X } from "@/components/common/icons"
import { useState, useRef } from "react"

export function TrailerDialog({
  videoId,
  title,
  onOpenChange,
}: {
  videoId: string
  title: string
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  function close() {
    dialog.current?.close()
    setOpen(false)
    onOpenChange?.(false)
  }
  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          dialog.current?.showModal()
          onOpenChange?.(true)
        }}
        className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-black/30 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-black/50"
      >
        <Play className="h-4 w-4" />
        Watch Trailer
      </button>
      <dialog
        ref={dialog}
        aria-label={`${title} trailer`}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-xl bg-black p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        onClose={() => {
          setOpen(false)
          onOpenChange?.(false)
        }}
        onCancel={close}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) close()
        }}
      >
        <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <h2 className="font-bold">{title} — Trailer</h2>
            <button
              onClick={close}
              aria-label="Close trailer"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="aspect-video">
            {open ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                title={`${title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  )
}
