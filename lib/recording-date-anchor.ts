function getSeoulTodayYmd(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T12:00:00");
  return !Number.isNaN(t);
}

/**
 * 방송/녹화 일정에서 Vision·OCR이 연도를 잘못 넣는 경우가 잦아,
 * 월·일은 유지하고 연도는 서울 기준 올해로 고정합니다.
 * 단, 12월에 다음 해 1~2월 일정을 미리 올리는 경우는 다음 해로 둡니다.
 */
export function anchorRecordingScheduleDateYmd(ymd: string): string {
  const s = String(ymd).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [, m, d] = s.split("-").map(Number);
  const today = getSeoulTodayYmd();
  const cy = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  const targetYear = currentMonth === 12 && (m === 1 || m === 2) ? cy + 1 : cy;

  const candidate = `${targetYear}-${pad2(m)}-${pad2(d)}`;
  if (isValidYmd(candidate)) return candidate;
  return s;
}
