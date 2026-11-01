import { Suspense } from "react";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading room…</div>}>
      <RoomClient roomId={id} />
    </Suspense>
  );
}