"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function SignOutButton() { const router = useRouter(); async function signOut() { await authClient.signOut(); router.push("/"); router.refresh(); } return <button className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-red-50" onClick={signOut}>Sign Out</button>; }
