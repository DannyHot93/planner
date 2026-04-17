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
 * 방송/녹화 일정에서 Vision·OCR이 연도를 잘못 넣는 경우(예: 2020-04-17) 보정합니다.
 * 월·일은 유지하고, 연도를 서울 기준 올해(또는 합리적 연도)로 맞춥니다.
 */
export function anchorRecordingScheduleDateYmd(ymd: string): string {
  const s = String(ymd).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-").map(Number);
  const today = getSeoulTodayYmd();
  const cy = parseInt(today.slice(0, 4), 10);

  /** 흔한 오인식 연도(2020 등) 또는 현재와 4년 이상 차이 나면 같은 월·일로 올해 맞춤 */
  const yearGap = cy - y;
  const suspiciousOld =
    (y === 2020 && cy >= 2024) ||
    (y <= 2022 && yearGap >= 4) ||
    yearGap >= 5;

  if (suspiciousOld) {
    const candidate = `${cy}-${pad2(m)}-${pad2(d)}`;
    if (isValidYmd(candidate)) return candidate;
  }
  return s;
}
