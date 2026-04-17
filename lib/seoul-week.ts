/**
 * YYYY-MM-DD 문자열만 사용하는 달력 연산 (타임존/DST 이슈 없음).
 * 요일은 UTC 달력과 동일(전 세계 같은 그레고리력 날짜).
 */

/**
 * AI가 `2026-04-16T15:00:00.000Z`(한국 4/17 자정)처럼 ISO 시각을 주면
 * `slice(0,10)`만 하면 UTC 날짜(16일)가 되어 요일 칸이 하루 밀립니다.
 * 순수 `YYYY-MM-DD`만 있으면 달력 날짜로 그대로 쓰고,
 * 그 외(시각 포함)는 Asia/Seoul 기준 달력 날짜로 맞춥니다.
 */
export function toSeoulDateYmd(input: string | undefined | null): string {
  if (input == null) return "";
  const s = String(input).trim();
  if (s === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    const m = s.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(t)
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 그레고리력 (y,m,d)의 요일 — JS와 동일: 0=일 … 6=토 */
export function calendarWeekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 해당 날짜가 속한 주의 월요일 YYYY-MM-DD */
export function mondayOfWeekContaining(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = calendarWeekday(y, m, d);
  const daysFromMonday = (wd + 6) % 7;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() - daysFromMonday);
  const yy = base.getUTCFullYear();
  const mm = base.getUTCMonth() + 1;
  const dd = base.getUTCDate();
  return `${yy}-${pad2(mm)}-${pad2(dd)}`;
}

/** 월요일부터 7일 YYYY-MM-DD */
export function sevenDaysFromMonday(mondayYmd: string): string[] {
  const [y, m, d] = mondayYmd.split("-").map(Number);
  const out: string[] = [];
  const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 7; i++) {
    const t = new Date(base);
    t.setUTCDate(base.getUTCDate() + i);
    out.push(
      `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
    );
  }
  return out;
}

/** YYYY-MM-DD에 일 수를 더함 (그레고리력, UTC 날짜 연산) */
export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}

/** 해당 달력 날짜가 일요일이면 true (0=일) */
export function isSundayYmd(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  return calendarWeekday(y, m, d) === 0;
}
