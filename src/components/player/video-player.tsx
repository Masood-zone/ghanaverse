"use client";

import { Expand, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

export function VideoPlayer({ assetId, src, poster, initialPosition = 0 }: { assetId: string; src: string; poster?: string | null; initialPosition?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const positionRef = useRef(initialPosition);
  const durationRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [duration, setDuration] = useState(0);
  const { mutate } = useMutation({ mutationFn: (completed: boolean) => api("/progress", { method: "PUT", body: JSON.stringify({ videoAssetId: assetId, positionSeconds: Math.floor(positionRef.current), durationSeconds: durationRef.current ? Math.floor(durationRef.current) : undefined, completed }) }) });
  const save = useCallback((completed = false) => { if (positionRef.current > 0) mutate(completed); }, [mutate]);
  useEffect(() => {
    const interval = window.setInterval(() => { if (!ref.current?.paused) save(false); }, 15_000);
    const flush = () => {
      if (!positionRef.current) return;
      void fetch("/api/progress", { method: "PUT", credentials: "include", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ videoAssetId: assetId, positionSeconds: Math.floor(positionRef.current), durationSeconds: durationRef.current ? Math.floor(durationRef.current) : undefined, completed: false }) });
    };
    window.addEventListener("pagehide", flush);
    return () => { window.clearInterval(interval); window.removeEventListener("pagehide", flush); };
  }, [assetId, save]);
  const seek = (seconds: number) => { if (!ref.current) return; ref.current.currentTime = Math.max(0, Math.min(duration, ref.current.currentTime + seconds)); };
  const toggle = async () => { if (!ref.current) return; if (ref.current.paused) await ref.current.play(); else ref.current.pause(); };
  return <div className="overflow-hidden rounded-xl bg-[#0d1726] shadow-2xl"><div className="relative aspect-video bg-black"><video ref={ref} src={src} poster={poster ?? undefined} preload="metadata" className="h-full w-full object-contain" onLoadedMetadata={(event) => { const value = event.currentTarget.duration || 0; durationRef.current = value; setDuration(value); if (initialPosition > 0 && initialPosition < value) event.currentTarget.currentTime = initialPosition; }} onTimeUpdate={(event) => { positionRef.current = event.currentTarget.currentTime; setPosition(event.currentTarget.currentTime); }} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); save(false); }} onEnded={() => { setPlaying(false); save(true); }} /><button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 grid place-items-center text-white opacity-0 transition hover:bg-black/10 hover:opacity-100 focus-visible:opacity-100"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-slate-950 shadow-xl">{playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}</span></button></div><div className="bg-gradient-to-b from-[#17263a] to-[#0d1726] p-4 text-white"><input aria-label="Playback position" type="range" min={0} max={duration || 1} value={position} onChange={(event) => { const value = Number(event.target.value); positionRef.current = value; if (ref.current) ref.current.currentTime = value; setPosition(value); }} onPointerUp={() => save(false)} onKeyUp={() => save(false)} className="h-1 w-full accent-amber-500" /><div className="mt-3 flex items-center gap-2"><Control label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause /> : <Play />}</Control><Control label="Back 10 seconds" onClick={() => seek(-10)}><RotateCcw /></Control><Control label="Forward 10 seconds" onClick={() => seek(10)}><RotateCw /></Control><Control label={muted ? "Unmute" : "Mute"} onClick={() => { if (ref.current) ref.current.muted = !muted; setMuted(!muted); }}>{muted ? <VolumeX /> : <Volume2 />}</Control><span className="ml-2 text-xs text-white/70">{formatTime(position)} / {formatTime(duration)}</span><Control label="Fullscreen" className="ml-auto" onClick={() => ref.current?.requestFullscreen()}><Expand /></Control></div></div></div>;
}
function Control({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) { return <button aria-label={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-md hover:bg-white/10 [&>svg]:h-4 [&>svg]:w-4 ${className}`}>{children}</button>; }
function formatTime(value: number) { if (!Number.isFinite(value)) return "0:00"; const minutes = Math.floor(value / 60); const seconds = Math.floor(value % 60); return `${minutes}:${String(seconds).padStart(2, "0")}`; }
