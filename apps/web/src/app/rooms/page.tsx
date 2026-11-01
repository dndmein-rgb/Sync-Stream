"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError, roomsApi } from "@/lib/api";
import {
  Alert,
  Button,
  Field,
  Header,
  Input,
  Shell,
} from "@/components/ui";

export default function RoomsLobbyPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("Movie night");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const room = await roomsApi.create({ name, visibility: "PRIVATE" });
      router.push(`/rooms/${room.id}?code=${encodeURIComponent(room.code)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await roomsApi.joinByCode(code.trim().toUpperCase());
      const room = result.room;
      router.push(
        `/rooms/${room.id}?code=${encodeURIComponent(room.code)}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join room");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <Shell>
        <p className="text-slate-400">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        title="Rooms"
        right={
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">
              {user.name}
            </span>
            <Button variant="ghost" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <form className="card space-y-4 p-6" onSubmit={createRoom}>
          <h2 className="text-lg font-medium text-white">Create a room</h2>
          <p className="text-sm text-slate-400">
            You become the host. Share the room code so friends can join.
          </p>
          <Field label="Room name">
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            Create private room
          </Button>
        </form>

        <form className="card space-y-4 p-6" onSubmit={joinRoom}>
          <h2 className="text-lg font-medium text-white">Join with code</h2>
          <p className="text-sm text-slate-400">
            Enter the invite code from the host.
          </p>
          <Field label="Room code">
            <Input
              required
              minLength={4}
              maxLength={32}
              placeholder="e.g. ABCD2345"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Button type="submit" variant="ghost" disabled={busy} className="w-full">
            Join room
          </Button>
        </form>
      </div>
    </Shell>
  );
}