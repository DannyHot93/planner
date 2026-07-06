"use client";

import { useEffect, useState } from "react";

type MemoStatus = "loading" | "ready" | "saving" | "saved" | "error";

interface SharedMemoPayload {
  memo: string;
  updatedAt: string | null;
}

async function fetchSharedMemo(): Promise<SharedMemoPayload> {
  const res = await fetch("/api/shared-memo", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : "메모를 불러오지 못했습니다."
    );
  }
  return res.json() as Promise<SharedMemoPayload>;
}

async function saveSharedMemo(memo: string): Promise<SharedMemoPayload> {
  const res = await fetch("/api/shared-memo", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : "메모를 저장하지 못했습니다."
    );
  }
  return res.json() as Promise<SharedMemoPayload>;
}

export default function SharedMemoBox({ compact = false }: { compact?: boolean }) {
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<MemoStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSharedMemo()
      .then((payload) => {
        if (cancelled) return;
        setMemo(payload.memo);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "메모를 불러오지 못했습니다.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSaving = status === "saving";

  return (
    <section
      aria-label="메모"
      className={`rounded-lg border border-white/10 bg-[#101018] p-3 shadow-md shadow-black/30 ${
        compact ? "mt-3" : "mb-3"
      }`}
    >
      <div
        className={`mb-2 flex gap-2 ${
          compact
            ? "flex-col items-stretch"
            : "flex-wrap items-center justify-between"
        }`}
      >
        <h2 className="text-sm font-bold text-white">메모</h2>
        <button
          type="button"
          disabled={isSaving || status === "loading"}
          onClick={() => {
            setStatus("saving");
            setError(null);
            saveSharedMemo(memo)
              .then((payload) => {
                setMemo(payload.memo);
                setStatus("saved");
              })
              .catch((e) => {
                setError(e instanceof Error ? e.message : "메모를 저장하지 못했습니다.");
                setStatus("error");
              });
          }}
          className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-md bg-[#4361DE] px-3 py-1.5 text-xs font-semibold text-white shadow shadow-[#4361DE]/25 transition-colors hover:bg-[#3551c0] disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? "w-full" : ""
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {isSaving ? "저장 중" : "저장"}
        </button>
      </div>
      <textarea
        value={memo}
        disabled={status === "loading"}
        onChange={(e) => {
          setMemo(e.target.value);
          if (status === "saved") setStatus("ready");
        }}
        placeholder="메모를 입력하세요."
        rows={compact ? 5 : 4}
        maxLength={5000}
        className="min-h-24 w-full resize-y rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm leading-6 text-gray-100 outline-none transition-colors placeholder:text-gray-500 focus:border-[#4361DE]/70 focus:ring-2 focus:ring-[#4361DE]/25 disabled:opacity-60"
      />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
