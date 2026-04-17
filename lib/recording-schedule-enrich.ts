import { AiAnalysisResult } from "./types";
import { anchorRecordingScheduleDateYmd } from "./recording-date-anchor";
import { toSeoulDateYmd } from "./seoul-week";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Asia/Seoul 기준 오늘 YYYY-MM-DD */
export function getSeoulTodayYmd(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T12:00:00");
  return !Number.isNaN(t);
}

function extractYmdListFromText(text: string): string[] {
  const re = /\d{4}-\d{2}-\d{2}/g;
  const m = text.match(re);
  return m ? [...new Set(m)] : [];
}

function refYearFromBounds(bounds: string[], fallbackYmd: string): number {
  if (bounds.length >= 1) {
    return parseInt(bounds[0].slice(0, 4), 10);
  }
  return parseInt(fallbackYmd.slice(0, 4), 10);
}

function normalizeEntryDate(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (s === "" || s === "null") return "";
  const ymd = toSeoulDateYmd(s) || s.slice(0, 10);
  return isValidYmd(ymd) ? ymd : "";
}

function rowTextForInference(row: Record<string, unknown>): string {
  return [row.note, row.time, row.place, row.person]
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x))
    .join(" ");
}

/** "5월 6일" "5/6" 등 — 연도는 refYear */
function parseKoreanStyleMonthDay(text: string, refYear: number): string | null {
  const km = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (km) {
    const mo = parseInt(km[1], 10);
    const d = parseInt(km[2], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const ymd = `${refYear}-${pad2(mo)}-${pad2(d)}`;
      return isValidYmd(ymd) ? ymd : null;
    }
  }
  const slash = text.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:\s*\(|$|\s|$)/);
  if (slash) {
    const mo = parseInt(slash[1], 10);
    const d = parseInt(slash[2], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const ymd = `${refYear}-${pad2(mo)}-${pad2(d)}`;
      return isValidYmd(ymd) ? ymd : null;
    }
  }
  return null;
}

/**
 * 사무실/제작 일정 AI 결과를 보강합니다.
 * - date가 비어 있으면 period·summary·행 텍스트에서 추론
 * - 표에서 위 행 날짜만 있는 경우 아래 행에 동일 날짜 이어 붙임
 */
export function enrichRecordingScheduleAiResult(
  aiResult: AiAnalysisResult,
  documentType: "office-schedule" | "production-schedule"
): AiAnalysisResult {
  const scheduleType = documentType === "office-schedule" ? "office" : "production";
  const details = { ...(aiResult.details as Record<string, unknown>) };
  details.scheduleType = scheduleType;

  const period = typeof details.period === "string" ? details.period : "";
  const title = typeof details.title === "string" ? details.title : "";
  const summary = aiResult.summary || "";
  const bounds = extractYmdListFromText(`${period} ${summary} ${title}`).map(
    anchorRecordingScheduleDateYmd
  );
  const todayYmd = getSeoulTodayYmd();
  const refYear = refYearFromBounds(bounds, todayYmd);

  let entries = Array.isArray(details.entries) ? [...details.entries] : [];

  if (entries.length === 0) {
    const fallbackDate = anchorRecordingScheduleDateYmd(bounds[0] ?? todayYmd);
    entries = [{ date: fallbackDate, note: summary || undefined }];
  } else {
    entries = entries.map((e) =>
      e && typeof e === "object" ? { ...(e as Record<string, unknown>) } : e
    );

    const pool = bounds.length > 0 ? bounds : [todayYmd];
    let lastYmd = pool[0];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;

      let ymd = normalizeEntryDate(row.date);
      if (!ymd) {
        ymd = parseKoreanStyleMonthDay(rowTextForInference(row), refYear) ?? "";
      }
      if (!ymd && pool.length > i) {
        ymd = pool[Math.min(i, pool.length - 1)];
      }
      if (!ymd && pool.length >= 1) {
        ymd = pool[0];
      }
      if (!ymd) {
        ymd = lastYmd;
      }
      if (!ymd) {
        ymd = todayYmd;
      }

      row.date = anchorRecordingScheduleDateYmd(ymd);
      lastYmd = ymd;
      entries[i] = row;
    }
  }

  details.entries = entries;
  return { summary: aiResult.summary, details };
}
