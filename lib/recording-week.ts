import { ScheduleRecord } from "./types";
import { mondayOfWeekContaining, toSeoulDateYmd } from "./seoul-week";

/** Asia/Seoul 기준 오늘 YYYY-MM-DD */
export function getTodaySeoulYmd(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/**
 * 녹화 레코드가 홈의「이번 주 / 이번 주 외」구분에 쓰는 기준일.
 * entries에 방송일(date)이 있으면 그중 첫 유효값, 없으면 업로드일(서울 달력).
 */
export function getEffectiveRecordingYmd(record: ScheduleRecord): string {
  const d = record.details as { entries?: { date?: string }[] };
  const entries = Array.isArray(d.entries) ? d.entries : [];
  for (const e of entries) {
    if (e?.date) {
      const y = toSeoulDateYmd(String(e.date));
      if (y && /^\d{4}-\d{2}-\d{2}$/.test(y)) return y;
    }
  }
  return toSeoulDateYmd(record.uploadedAt) || record.uploadedAt.slice(0, 10);
}

/** 오늘이 속한 주(월~일)와 같은 주에 기준일이 있으면 이번 주 */
export function classifyRecordingWeekScope(effectiveYmd: string): "this-week" | "other-week" {
  const today = getTodaySeoulYmd();
  return mondayOfWeekContaining(effectiveYmd) === mondayOfWeekContaining(today)
    ? "this-week"
    : "other-week";
}
