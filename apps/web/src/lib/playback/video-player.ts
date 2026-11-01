export interface VideoPlayer {
  getCurrentTime(): number;
  isPlaying(): boolean;
  play(): Promise<void>;
  pause(): void;
  seek(position: number): void;
  setPlaybackRate(rate: number): void;
  setSrc(url: string): void;
  getSrc(): string;
  ready(): boolean;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
}

function normalizeUrl(url: string): string {
  try {
    return new URL(
      url,
      typeof window !== "undefined" ? window.location.href : "http://localhost",
    ).href;
  } catch {
    return url;
  }
}

export class HtmlVideoPlayer implements VideoPlayer {
  constructor(private readonly el: HTMLVideoElement) {}

  getCurrentTime(): number {
    return this.el.currentTime || 0;
  }

  isPlaying(): boolean {
    return !this.el.paused && !this.el.ended;
  }

  async play(): Promise<void> {
    try {
      await this.el.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        throw new Error("PLAY_BLOCKED");
      }
    }
  }

  pause(): void {
    this.el.pause();
  }

  seek(position: number): void {
    if (!Number.isFinite(position) || position < 0) return;
    try {
      this.el.currentTime = position;
    } catch {
      /* ignore while metadata loading */
    }
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.el.playbackRate = rate;
  }

  setSrc(url: string): void {
    const next = url.trim();
    if (!next) return;
    const current = this.getSrc();
    if (current && normalizeUrl(current) === normalizeUrl(next)) return;
    this.el.src = next;
    this.el.load();
  }

  getSrc(): string {
    return this.el.currentSrc || this.el.src || "";
  }

  ready(): boolean {
    return this.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  on(event: string, handler: () => void): void {
    this.el.addEventListener(event, handler);
  }

  off(event: string, handler: () => void): void {
    this.el.removeEventListener(event, handler);
  }
}