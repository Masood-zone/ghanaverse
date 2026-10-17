"use client"

import Link from "@/components/common/app-link"
import { ProfileManager } from "@/components/profiles/profile-manager"

export function ProfilesContent({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_8%_15%,#fef3c7,transparent_26%),radial-gradient(circle_at_90%_88%,#dcfce7,transparent_28%),#faf9f6]">
      <div className="gv-container py-14 text-center md:py-24">
        <span className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold tracking-wider text-slate-600 uppercase shadow-sm">
          Your GhanaVerse
        </span>
        <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">
          Who&apos;s watching?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Choose a profile to access personalized Ghanaian stories, your
          library, and viewing history.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Each profile has its own saved list, history, resume positions,
          recommendations, and playback preferences.
        </p>
        <ProfileManager callbackUrl={callbackUrl} />
        <div className="mx-auto mt-12 max-w-2xl border-t pt-6 text-right">
          <Link
            href="/account"
            className="text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            Account settings →
          </Link>
        </div>
      </div>
    </main>
  )
}
