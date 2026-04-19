import { ScheduleRecord, VacationDetails, ScheduleEntry } from "@/lib/types";
import { toSeoulDateYmd } from "@/lib/seoul-week";

/** 텍스트에 포함된 YYYY-MM-DD 전부 (정렬·최댓값용) */
function extractYmdListFromText(text: string | undefined | null): string[] {
  if (text == null || typeof text !== "string") return [];
  const m = text.match(/\d{4}-\d{2}-\d{2}/g);
  return m ?? [];
}

/**
 * period 문자열에서 시작~끝 구간.
 * ~ / 전각～ / en– / em— 등 구분자 허용 (복붙·AI 출력 차이 대비).
 */
function parsePeriodRange(period: string | undefined): { start: string; end: string } | null {
  if (!period || typeof period !== "string") return null;
  const t = period.trim();
  const m = t.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:~|～|–|—)\s*(\d{4}-\d{2}-\d{2})/
  );
  if (!m) return null;
  return { start: m[1], end: m[2] };
}

function extractVacationDate(entry: { date?: string }, record: ScheduleRecord): string {
  if (entry.date) {
    const ymd = toSeoulDateYmd(entry.date);
    if (ymd) return ymd;
  }
  const details = record.details as { period?: string | null };
  if (details.period) {
    const match = String(details.period).match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return toSeoulDateYmd(record.uploadedAt) || record.uploadedAt.slice(0, 10);
}

/**
 * 휴가 레코드의 가장 마지막 일정일(YYYY-MM-DD).
 * 파싱 불가 시 null — 삭제 대상에서 제외.
 */
export function getVacationLatestDateYmd(record: ScheduleRecord): string | null {
  const details = record.details as VacationDetails;
  const entries = Array.isArray(details.entries) ? details.entries : [];
  const dates: string[] = [];

  const pr = parsePeriodRange(details.period);
  if (pr) {
    dates.push(pr.start, pr.end);
  }
  /** period가 "2026-04-01 ~ 2026-04-05" 형식이 아니어도 날짜만 있으면 수집 */
  if (typeof details.period === "string" && details.period.trim()) {
    dates.push(...extractYmdListFromText(details.period));
  }
  dates.push(...extractYmdListFromText(record.summary));
  dates.push(...extractYmdListFromText(record.memo));

  if (entries.length === 0) {
    dates.push(extractVacationDate({}, record));
  } else {
    for (const entry of entries) {
      dates.push(extractVacationDate(entry as ScheduleEntry, record));
    }
  }

  const valid = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (valid.length === 0) return null;
  valid.sort();
  return valid[valid.length - 1];
}

/** 오늘(Asia/Seoul) 이전에 끝난 휴가만 제거 */
export function keepVacationNotPast(record: ScheduleRecord, todayYmd: string): boolean {
  const max = getVacationLatestDateYmd(record);
  if (max === null) return true;
  return max >= todayYmd;
}

export function filterPastVacations(records: ScheduleRecord[], todayYmd: string): ScheduleRecord[] {
  return records.filter((r) => keepVacationNotPast(r, todayYmd));
}
