"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRecordButton({
  recordId,
  className = "",
}: {
  recordId: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        "이 업로드 일정을 삭제할까요? GitHub 저장소에 반영되며 복구할 수 없습니다."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "삭제에 실패했습니다.");
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void handleDelete();
      }}
      disabled={loading}
      className={`text-xs font-medium text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 ${className}`}
    >
      {loading ? "삭제 중…" : "삭제"}
    </button>
  );
}
