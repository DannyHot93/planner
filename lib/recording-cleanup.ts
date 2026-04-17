import { ScheduleRecord } from "@/lib/types";
import {
  addDaysYmd,
  isSundayYmd,
  mondayOfWeekContaining,
  toSeoulDateYmd,
} from "@/lib/seoul-week";

export function getTodaySeoulYmd(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/**
 * 녹화일정: 이번 주(월~일) 월요일 이전 날짜만 있으면 제거 대상.
 * 직전 주(바로 이전 월~일)에만 걸친 일정은, 그 주의 일요일이 끝나기 전(일요일 당일 포함) 유지.
 * 월요일이 되면 직전 주 일정은 삭제.
 */
export function keepRecordingAfterWeeklyCleanup(
  record: ScheduleRecord,
  todayYmd: string,
  thisWeekMondayYmd: string
): boolean {
  const details = record.details as { entries?: { date?: string }[]; period?: string };
  const entries = Array.isArray(details.entries) ? details.entries : [];

  const prevWeekMondayYmd = addDaysYmd(thisWeekMondayYmd, -7);
  const prevWeekSundayYmd = addDaysYmd(thisWeekMondayYmd, -1);

  if (entries.length > 0) {
    const hasMissingDate = entries.some((e) => !toSeoulDateYmd(e.date));
    if (hasMissingDate) return true;

    const entryDates = entries
      .map((e) => toSeoulDateYmd(e.date))
      .filter((d): d is string => Boolean(d));

    if (entryDates.length === 0) return true;

    const anyThisWeekOrLater = entryDates.some((d) => d >= thisWeekMondayYmd);
    if (anyThisWeekOrLater) return true;

    const allInPrevWeekOnly = entryDates.every(
      (d) => d >= prevWeekMondayYmd && d <= prevWeekSundayYmd
    );
    if (isSundayYmd(todayYmd) && allInPrevWeekOnly) return true;

    return false;
  }

  if (details.period) {
    const match = String(details.period).match(/\d{4}-\d{2}-\d{2}/);
    if (match) {
      const p = match[0];
      if (p >= thisWeekMondayYmd) return true;
      const inPrev = p >= prevWeekMondayYmd && p <= prevWeekSundayYmd;
      if (isSundayYmd(todayYmd) && inPrev) return true;
      return false;
    }
  }

  const up =
    toSeoulDateYmd(record.uploadedAt) || record.uploadedAt.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(up)) {
    if (up >= thisWeekMondayYmd) return true;
    const inPrev = up >= prevWeekMondayYmd && up <= prevWeekSundayYmd;
    if (isSundayYmd(todayYmd) && inPrev) return true;
  }
  return false;
}

/** 녹화일정 배열을 오늘 기준으로 필터 (GitHub 덮어쓰기 전에 사용) */
export function filterRecordingsWeeklyCleanup(records: ScheduleRecord[]): ScheduleRecord[] {
  const todayYmd = getTodaySeoulYmd();
  const thisWeekMondayYmd = mondayOfWeekContaining(todayYmd);
  return records.filter((record) =>
    keepRecordingAfterWeeklyCleanup(record, todayYmd, thisWeekMondayYmd)
  );
}
