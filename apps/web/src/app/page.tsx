"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Shell } from "@/components/ui";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/rooms");
  }, [loading, user, router]);

  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.25em] text-accent-soft">
          Watch parties, synchronized
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SyncStream
        </h1>
        <p className="mt-4 max-w-md text-slate-400">
          Create a room, share a code, and watch the same video in lockstep —
          with chat, presence, and host-controlled playback.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/register">
            <Button variant="ghost">Create account</Button>
          </Link>
        </div>
      </div>
    </Shell>
  );
}