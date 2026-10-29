import type { PlaybackState } from "@syncstream/contracts";

/** Internal mutable record kept by the service. */
export type RoomPlayback = PlaybackState;

/** Result returned after a successful command. */
export type ApplyCommandResult = {
  state: PlaybackState;
  /** true when this command was a no-op (duplicate commandId) */
  duplicate: boolean;
};