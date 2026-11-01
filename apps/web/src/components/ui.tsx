"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
      {children}
    </div>
  );
}

export function Header({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">
          SyncStream
        </p>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger";
  },
) {
  const { variant = "primary", className = "", ...rest } = props;
  const v =
    variant === "ghost"
      ? "btn-ghost"
      : variant === "danger"
        ? "btn-danger"
        : "btn-primary";
  return <button className={`${v} ${className}`} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`input ${className}`} {...rest} />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "ok";
  children: ReactNode;
}) {
  const colors =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "info"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${colors}`}>
      {children}
    </div>
  );
}

export function StatusDot({
  status,
}: {
  status: "connected" | "connecting" | "disconnected" | "error" | "idle";
}) {
  const color =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-rose-400"
          : "bg-slate-500";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {status}
    </span>
  );
}