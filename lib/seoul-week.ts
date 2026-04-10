/**
 * YYYY-MM-DD 문자열만 사용하는 달력 연산 (타임존/DST 이슈 없음).
 * 요일은 UTC 달력과 동일(전 세계 같은 그레고리력 날짜).
 */

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
