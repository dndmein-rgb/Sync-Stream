"use client";

import type { RoomMemberView, RoomRole } from "@syncstream/contracts";
import { Button } from "@/components/ui";

type Props = {
  members: RoomMemberView[];
  myRole: RoomRole | null;
  myUserId: string | undefined;
  hostId: string | undefined;
  onTransfer: (userId: string) => void;
  onRemove: (userId: string) => void;
  onChangeRole: (userId: string, role: "CO_HOST" | "VIEWER") => void;
};

function roleBadge(role: RoomRole) {
  const color =
    role === "HOST"
      ? "bg-amber-500/20 text-amber-200"
      : role === "CO_HOST"
        ? "bg-sky-500/20 text-sky-200"
        : "bg-white/10 text-slate-300";
  return <span className={`badge ${color}`}>{role}</span>;
}

export function MembersPanel({
  members,
  myRole,
  myUserId,
  hostId,
  onTransfer,
  onRemove,
  onChangeRole,
}: Props) {
  const isHost = myRole === "HOST";

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-medium text-white">
        Members ({members.length})
      </h3>
      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${m.online ? "bg-emerald-400" : "bg-slate-600"}`}
                />
                <span className="truncate text-sm text-white">
                  {m.name}
                  {m.userId === myUserId ? " (you)" : ""}
                </span>
              </div>
              <div className="mt-1">{roleBadge(m.role)}</div>
            </div>
            {isHost && m.userId !== myUserId && (
              <div className="flex flex-wrap gap-1">
                {m.userId !== hostId && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => onTransfer(m.userId)}
                  >
                    Make host
                  </Button>
                )}
                {m.role !== "CO_HOST" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => onChangeRole(m.userId, "CO_HOST")}
                  >
                    Co-host
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => onChangeRole(m.userId, "VIEWER")}
                  >
                    Demote
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  onClick={() => onRemove(m.userId)}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}