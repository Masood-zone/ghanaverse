import type { HTMLAttributes } from "react"
import { MaterialSymbol } from "./MaterialSymbol"
type Props = HTMLAttributes<HTMLSpanElement> & {
  fill?: string
  strokeWidth?: number
  size?: number
}
export function AlertTriangle({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="warning"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function ArrowLeft({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="arrow_back"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function ArrowRight({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="arrow_forward"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function BookOpen({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="menu_book"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Bookmark({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="bookmark"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Check({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="check"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Clapperboard({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="movie"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Clock3({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="schedule"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Database({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="category"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Edit3({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="edit"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Expand({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="fullscreen"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function ExternalLink({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="open_in_new"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Eye({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="visibility"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function EyeOff({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="visibility_off"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function FileCheck2({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="fact_check"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function FilePenLine({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="edit_document"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Film({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="movie"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function History({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="history"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function ImageIcon({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="image"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Info({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="info"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function LayoutDashboard({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="dashboard"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Library({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="video_library"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function LibraryBig({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="video_library"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function LockKeyhole({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="lock"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Mail({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="mail"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Menu({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="menu"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Pause({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="pause"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Play({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="play_arrow"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function PlayCircle({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="play_circle"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Plus({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="add"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function RotateCcw({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="replay"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function RotateCw({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="forward_10"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Save({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="save"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Search({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="search"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function ShieldCheck({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="verified_user"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Star({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="star"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Tags({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="sell"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Trash2({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="delete"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Tv({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="tv"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function UserRound({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="person"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Users({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="group"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function UsersRound({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="group"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function Volume2({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="volume_up"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function VolumeX({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="volume_off"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
export function X({ fill, strokeWidth, size, ...props }: Props) {
  void strokeWidth
  return (
    <MaterialSymbol
      icon="close"
      filled={fill === "currentColor"}
      style={{ fontSize: size ?? "1.25em", ...props.style }}
      {...props}
    />
  )
}
