"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMarkRecordRemoved } from "./RecordDeleteContext";

export type ScheduleFieldsConfig = {
  initialTitle: string;
  initialTime: string;
  /** 없으면 시간 필드는 숨기고 제목·요약·메모만 저장 */
  entryDateYmd?: string;
};

export default function InlineRecordEditor({
  recordId,
  initialSummary,
  initialMemo,
  compact = false,
  className = "",
  scheduleFields,
}: {
  recordId: string;
  initialSummary: string;
  initialMemo: string;
  compact?: boolean;
  className?: string;
  /** 사무실·제작 일정 카드: 제목(프로그램명)·날짜별 시간 */
  scheduleFields?: ScheduleFieldsConfig;
}) {
  const router = useRouter();
  const markRemoved = useMarkRecordRemoved();
  const [summary, setSummary] = useState(initialSummary);
  const [memo, setMemo] = useState(initialMemo);
  const [title, setTitle] = useState(scheduleFields?.initialTitle ?? "");
  const [time, setTime] = useState(scheduleFields?.initialTime ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSummary(initialSummary);
    setMemo(initialMemo);
  }, [recordId, initialSummary, initialMemo]);

  useEffect(() => {
    if (scheduleFields) {
      setTitle(scheduleFields.initialTitle);
      setTime(scheduleFields.initialTime);
    }
  }, [
    recordId,
    scheduleFields?.initialTitle,
    scheduleFields?.initialTime,
    scheduleFields?.entryDateYmd,
  ]);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string> = { summary, memo };
      if (scheduleFields) {
        payload.title = title;
        if (scheduleFields.entryDateYmd && scheduleFields.entryDateYmd.trim() !== "") {
          payload.entryDateYmd = scheduleFields.entryDateYmd.trim();
          payload.entryTime = time;
        }
      }
      const res = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }
      await router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        "이 일정을 삭제할까요? GitHub 저장소에 반영되며 복구할 수 없습니다."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "삭제에 실패했습니다.");
      }
      markRemoved?.(recordId);
      await router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const ta = compact ? "text-[11px] leading-snug" : "text-xs";
  const rows = compact ? { summary: 2, memo: 2 } : { summary: 2, memo: 3 };
  const inp = compact
    ? "mt-0.5 w-full rounded-lg border border-gray-200 px-1.5 py-1 text-[11px] leading-snug"
    : "mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {scheduleFields && (
        <>
          <label className="block">
            <span className="text-[10px] font-medium text-gray-500">제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inp}
              autoComplete="off"
            />
          </label>
          {scheduleFields.entryDateYmd && scheduleFields.entryDateYmd.trim() !== "" && (
            <label className="block">
              <span className="text-[10px] font-medium text-gray-500">시간</span>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="예: 14:00"
                className={inp}
                autoComplete="off"
              />
            </label>
          )}
        </>
      )}
      <label className="block">
        <span className="text-[10px] font-medium text-gray-500">요약</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={rows.summary}
          className={`mt-0.5 w-full rounded-lg border border-gray-200 px-1.5 py-1 ${ta}`}
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium text-gray-500">메모</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={rows.memo}
          className={`mt-0.5 w-full rounded-lg border border-gray-200 px-1.5 py-1 ${ta}`}
        />
      </label>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || deleting}
          className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={saving || deleting}
          className="rounded-md px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </div>
  );
}
