import * as XLSX from "xlsx";
import type { CellObject } from "xlsx";
import { toSeoulDateYmd } from "@/lib/seoul-week";
import type { VacationKind } from "@/lib/types";

/** 고정 양식: B~I (0-based col index 1~8) */
const COL = {
  name: 1,
  category: 2,
  startDate: 3,
  weekdayStart: 4,
  endDate: 5,
  weekdayEnd: 6,
  dayCount: 7,
  remark: 8,
} as const;

/**
 * 0-based 행 인덱스: 0 = 엑셀 1행(헤더), 1 = 엑셀 2행(첫 데이터).
 * 양식 고정: 1행 헤더만 두고 2행부터 내용.
 */
const FIRST_DATA_ROW_0INDEX = 1;

/** 데이터 행에서 헤더가 또 나오면 건너뜀(복붙 실수 대비) */
const HEADER_NAME_PATTERN =
  /^(이름|성명|name|휴가자|대상자|소속)$/i;

export interface FixedVacationExcelRow {
  name: string;
  category: string;
  startYmd: string;
  endYmd: string;
  weekdayStart: string;
  weekdayEnd: string;
  dayCount: string;
  remark: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Date → YYYY-MM-DD (UTC 날짜 — 서버 TZ와 무관하게 달력일 유지) */
function dateUtcToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/**
 * Excel 시리얼(1900 날짜 체계) → YYYY-MM-DD.
 * 25569 = 1970-01-01에 해당하는 시리얼(UTC 기준).
 */
function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  if (serial < 1 || serial > 600000) return null;
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = dateUtcToYmd(d);
  const y = parseInt(ymd.slice(0, 4), 10);
  if (y < 1980 || y > 2100) return null;
  return ymd;
}

/**
 * YYYYMMDD (구분 없는 8자리) — 엑셀에서 날짜를 텍스트/숫자로 둔 경우가 많음.
 * 예: 20260422 → 2026-04-22
 */
function parseCompactYmdDigits(t: string): string | null {
  const m = t.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 1980 || y > 2100) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** "2026. 4. 18", "2026/4/18", "2026-04-18" 등 */
function parseYmdFromLooseString(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const compact = parseCompactYmdDigits(t);
  if (compact) return compact;
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ko = t.match(
    /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/
  );
  if (ko) {
    return `${ko[1]}-${pad2(parseInt(ko[2], 10))}-${pad2(parseInt(ko[3], 10))}`;
  }
  const slash = t.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${pad2(parseInt(slash[2], 10))}-${pad2(parseInt(slash[3], 10))}`;
  }
  const ymd = toSeoulDateYmd(t);
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return null;
}

function cellToYmd(cell: CellObject | undefined): string {
  if (!cell || cell.v == null || cell.v === "") return "";

  const v = cell.v;
  if (v instanceof Date) {
    return dateUtcToYmd(v);
  }

  if (typeof v === "number") {
    if (v > 30000 && v < 120000) {
      const fromSerial = excelSerialToYmd(v);
      if (fromSerial) return fromSerial;
    }
    if (Number.isInteger(v) && v >= 19_000_101 && v <= 21_001_231) {
      const fromCompact = parseCompactYmdDigits(String(v));
      if (fromCompact) return fromCompact;
    }
  }

  if (typeof v === "string") {
    const loose = parseYmdFromLooseString(v);
    if (loose) return loose;
  }

  const w = cell.w != null ? String(cell.w).trim() : "";
  if (w) {
    const loose = parseYmdFromLooseString(w);
    if (loose) return loose;
  }

  return "";
}

/** 이름·구분·요일·비고 등 — 날짜 시리얼로 해석하지 않음 */
function cellToText(cell: CellObject | undefined): string {
  if (!cell || cell.v == null) return "";
  if (typeof cell.v === "string") return cell.v.trim();
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w).trim();
  if (typeof cell.v === "number" || typeof cell.v === "boolean") {
    return String(cell.v);
  }
  if (cell.v instanceof Date) return dateUtcToYmd(cell.v);
  return String(cell.v).trim();
}

function getCell(sheet: XLSX.WorkSheet, row: number, col: number): CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[addr] as CellObject | undefined;
}

/** 시트에 존재하는 셀 키로 최대 행(0-based) 계산 — !ref가 짧을 때 보정 */
function getMaxRowFromSheetKeys(sheet: XLSX.WorkSheet): number {
  let max = -1;
  for (const key of Object.keys(sheet)) {
    if (key[0] === "!") continue;
    try {
      const addr = XLSX.utils.decode_cell(key);
      max = Math.max(max, addr.r);
    } catch {
      /* ignore */
    }
  }
  return max;
}

/** sheet_to_json 행 값 → 날짜 (D·F 열) */
function valueToYmd(val: unknown): string {
  if (val == null || val === "") return "";
  if (val instanceof Date) return dateUtcToYmd(val);
  if (typeof val === "number") {
    if (val > 30000 && val < 120000) {
      const y = excelSerialToYmd(val);
      if (y) return y;
    }
    if (Number.isInteger(val) && val >= 19_000_101 && val <= 21_001_231) {
      const fromCompact = parseCompactYmdDigits(String(val));
      if (fromCompact) return fromCompact;
    }
  }
  const s = String(val).trim();
  if (/^\d{5,6}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 30000 && n < 120000) {
      const y = excelSerialToYmd(n);
      if (y) return y;
    }
  }
  return parseYmdFromLooseString(s) || "";
}

function valueToText(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val instanceof Date) return dateUtcToYmd(val);
  return String(val).trim();
}

export function inferVacationKindFromCategory(
  category: string,
  fallback: VacationKind
): VacationKind {
  const s = category.trim().toLowerCase();
  if (s.includes("주조") || s.includes("casting")) return "casting";
  if (
    s.includes("제작") ||
    s.includes("production") ||
    s.includes("방송") ||
    s.includes("제작팀")
  ) {
    return "production";
  }
  if (s.includes("사무실") || s.includes("office")) return "office";
  return fallback;
}

export function buildCombinedNote(row: FixedVacationExcelRow): string {
  const parts: string[] = [];
  if (row.category.trim()) parts.push(`구분: ${row.category.trim()}`);
  if (row.remark.trim()) parts.push(`비고: ${row.remark.trim()}`);
  return parts.join(" · ");
}

function parseSheetFixedRows(sheet: XLSX.WorkSheet): FixedVacationExcelRow[] {
  const ref = sheet["!ref"];
  const maxFromKeys = getMaxRowFromSheetKeys(sheet);
  const rangeEndR = ref ? XLSX.utils.decode_range(ref).e.r : -1;
  /** 2행(인덱스 1) ~ 실제 데이터가 있는 마지막 행까지 */
  const endRow = Math.max(rangeEndR, maxFromKeys, FIRST_DATA_ROW_0INDEX);
  if (endRow < FIRST_DATA_ROW_0INDEX) return [];

  /**
   * xlsx는 !ref가 없으면 sheet_to_json(range)가 빈 배열을 돌려준다.
   * 일부 내보내기/변환 파일은 !ref가 비어 있을 수 있어 최소 범위를 채운다.
   */
  if (!sheet["!ref"] && maxFromKeys >= 0) {
    sheet["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: endRow, c: 8 },
    });
  }

  /**
   * A~I 열(0~8)을 항상 같은 인덱스로 맞춤.
   * A열이 비어 있어 !ref가 B부터만 잡히는 파일에서 열이 밀리는 문제를 방지.
   */
  const table = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    range: {
      s: { r: FIRST_DATA_ROW_0INDEX, c: 0 },
      e: { r: endRow, c: 8 },
    },
  }) as unknown[][];

  const out: FixedVacationExcelRow[] = [];

  for (const row of table) {
    if (!Array.isArray(row)) continue;
    const name = valueToText(row[COL.name]).trim();
    if (!name) continue;
    if (HEADER_NAME_PATTERN.test(name)) continue;

    const startYmd = valueToYmd(row[COL.startDate]);
    const endYmd = valueToYmd(row[COL.endDate]) || startYmd;

    if (!startYmd || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) continue;
    if (!endYmd || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) continue;
    if (startYmd > endYmd) continue;

    const category = valueToText(row[COL.category]);
    const weekdayStart = valueToText(row[COL.weekdayStart]);
    const weekdayEnd = valueToText(row[COL.weekdayEnd]);
    const dayCount = valueToText(row[COL.dayCount]);
    const remark = valueToText(row[COL.remark]);

    out.push({
      name,
      category,
      startYmd,
      endYmd,
      weekdayStart,
      weekdayEnd,
      dayCount,
      remark,
    });
  }

  return out;
}

/**
 * B~I 열 고정. 엑셀 1행은 헤더로 읽지 않고, 2행(인덱스 1)부터만 데이터.
 * 첫 시트에 유효 행이 없으면 다른 시트를 순서대로 시도.
 */
export function parseFixedVacationExcel(buffer: Buffer): FixedVacationExcelRow[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: true,
    cellText: false,
  });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = parseSheetFixedRows(sheet);
    if (rows.length > 0) return rows;
  }

  return [];
}
