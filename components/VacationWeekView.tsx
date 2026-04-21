"use client";

import { useMemo } from "react";
import { ScheduleRecord, VacationDetails, ScheduleEntry } from "@/lib/types";
import DeleteRecordButton from "./DeleteRecordButton";
import InlineRecordEditor from "./InlineRecordEditor";
import { addDaysYmd, toSeoulDateYmd } from "@/lib/seoul-week";

function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
  return `${m}월 ${d}일 (${wd})`;
}

/** 우측 패널용: 월 없이 `17일 (목)` */
function formatDayWeekdayShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
  return `${d}일 (${wd})`;
}

function vacationKindOf(details: VacationDetails): "office" | "production" | "casting" {
  if (details.vacationKind === "production") return "production";
  if (details.vacationKind === "casting") return "casting";
  return "office";
}

function eachDayInclusive(startYmd: string, endYmd: string): string[] {
  if (startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = startYmd;
  for (let i = 0; i < 400; i++) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

function parsePeriodRange(period: string | undefined): { start: string; end: string } | null {
  if (!period || typeof period !== "string") return null;
  const m = period.trim().match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return { start: m[1], end: m[2] };
}

/**
 * period의 시작~종료가 연일이고, 해당 레코드 entries에 그 날짜가 빠짐없이 있을 때만 범위 반환.
 * (엑셀/폼 업로드에서 각 일자가 entries로 펼쳐지는 경우)
 */
function getConsecutiveVacationRangeForRecord(
  record: ScheduleRecord,
  details: VacationDetails
): { startYmd: string; endYmd: string } | null {
  const pr = parsePeriodRange(details.period);
  if (!pr) return null;
  const { start, end } = pr;
  if (start >= end) return null;
  const expected = eachDayInclusive(start, end);
  const entries = Array.isArray(details.entries) ? details.entries : [];
  const datesFromEntries = new Set<string>();
  if (entries.length === 0) {
    datesFromEntries.add(extractVacationDate({}, record));
  } else {
    for (const entry of entries) {
      datesFromEntries.add(extractVacationDate(entry as ScheduleEntry, record));
    }
  }
  for (const d of expected) {
    if (!datesFromEntries.has(d)) return null;
  }
  return { startYmd: start, endYmd: end };
}

function extractVacationDate(
  entry: { date?: string },
  record: ScheduleRecord
): string {
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

interface VacationFlatEntry {
  dateYmd: string;
  person?: string;
  reason?: string;
  note?: string;
  recordId: string;
  recordSummary: string;
  recordMemo: string;
  uploadedAt: string;
  /** 사무실 / 제작 */
  vacationKind: "office" | "production";
  /** 시작·종료가 연속일로 맞는 업로드(엑셀 등)일 때만 — 우측 패널에서 ~ 표시용 */
  consecutiveRange?: { startYmd: string; endYmd: string };
}

/** 동일인 병합 키 (이름 없으면 업로드 단위로 분리) */
function vacationPersonKey(e: VacationFlatEntry): string {
  const name = (e.person ?? e.recordSummary).trim();
  if (name) return `n:${name}`;
  return `id:${e.recordId}`;
}

interface MergedVacationPerson {
  displayName: string;
  dateYmds: string[];
  rows: VacationFlatEntry[];
}

interface TodayVacationRow {
  displayName: string;
  /** 사무실·제작 삭제·편집용 */
  recordIds?: string[];
  /** 행마다 표시할 날짜 문구 (우측: 연일이면 시작 ~ 종료) */
  dateLabel: string;
}

function collectVacationFlat(
  vacationRecords: ScheduleRecord[],
  kind: "office" | "production"
): VacationFlatEntry[] {
  const rows: VacationFlatEntry[] = [];
  for (const record of vacationRecords) {
    const details = record.details as VacationDetails;
    if (vacationKindOf(details) !== kind) continue;

    const consecutiveRange = getConsecutiveVacationRangeForRecord(record, details) ?? undefined;

    const entries = Array.isArray(details.entries) ? details.entries : [];
    if (entries.length === 0) {
      rows.push({
        dateYmd: extractVacationDate({}, record),
        recordId: record.id,
        recordSummary: record.summary,
        recordMemo: record.memo,
        uploadedAt: record.uploadedAt,
        vacationKind: kind,
        consecutiveRange,
      });
    } else {
      for (const entry of entries) {
        const e = entry as ScheduleEntry;
        rows.push({
          dateYmd: extractVacationDate(e, record),
          person: typeof e.person === "string" ? e.person : undefined,
          reason: typeof e.reason === "string" ? e.reason : undefined,
          note: typeof e.note === "string" ? e.note : undefined,
          recordId: record.id,
          recordSummary: record.summary,
          recordMemo: record.memo,
          uploadedAt: record.uploadedAt,
          vacationKind: kind,
          consecutiveRange,
        });
      }
    }
  }
  return rows;
}

function mergeVacationByPerson(rows: VacationFlatEntry[]): MergedVacationPerson[] {
  const map = new Map<string, MergedVacationPerson>();
  for (const row of rows) {
    const key = vacationPersonKey(row);
    const displayName = (row.person ?? row.recordSummary).trim() || "이름 미상";
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        displayName,
        dateYmds: [row.dateYmd],
        rows: [row],
      });
    } else {
      existing.rows.push(row);
      if (!existing.dateYmds.includes(row.dateYmd)) {
        existing.dateYmds.push(row.dateYmd);
      }
    }
  }
  for (const m of map.values()) {
    m.dateYmds.sort();
  }
  return [...map.values()].sort((a, b) => {
    const minA = a.dateYmds[0] ?? "";
    const minB = b.dateYmds[0] ?? "";
    const c = minA.localeCompare(minB);
    if (c !== 0) return c;
    return a.displayName.localeCompare(b.displayName, "ko");
  });
}

/** 사무실·제작 동일인을 한 카드로 합침 */
function mergeOfficeProductionLists(
  office: MergedVacationPerson[],
  production: MergedVacationPerson[]
): MergedVacationPerson[] {
  const map = new Map<string, MergedVacationPerson>();
  function add(m: MergedVacationPerson) {
    const key = `n:${m.displayName.trim()}` || vacationPersonKey(m.rows[0]);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        displayName: m.displayName,
        dateYmds: [...m.dateYmds],
        rows: [...m.rows],
      });
    } else {
      for (const row of m.rows) existing.rows.push(row);
      for (const d of m.dateYmds) {
        if (!existing.dateYmds.includes(d)) existing.dateYmds.push(d);
      }
      existing.dateYmds.sort();
    }
  }
  for (const m of office) add(m);
  for (const m of production) add(m);
  return [...map.values()].sort((a, b) => {
    const minA = a.dateYmds[0] ?? "";
    const minB = b.dateYmds[0] ?? "";
    const c = minA.localeCompare(minB);
    if (c !== 0) return c;
    return a.displayName.localeCompare(b.displayName, "ko");
  });
}

function uniqueRecordIds(rows: VacationFlatEntry[]): string[] {
  return [...new Set(rows.map((r) => r.recordId))];
}

function buildTodayRows(
  combined: MergedVacationPerson[],
  todayStr: string,
  sidebarMode: boolean
): TodayVacationRow[] {
  const out: TodayVacationRow[] = [];
  for (const m of combined) {
    if (!m.dateYmds.includes(todayStr)) continue;
    const rowsToday = m.rows.filter((r) => r.dateYmd === todayStr);
    let dateLabel: string;
    if (sidebarMode) {
      const hit = rowsToday.find(
        (r) =>
          r.consecutiveRange &&
          r.consecutiveRange.startYmd < r.consecutiveRange.endYmd &&
          todayStr >= r.consecutiveRange.startYmd &&
          todayStr <= r.consecutiveRange.endYmd
      );
      if (hit?.consecutiveRange) {
        const { startYmd, endYmd } = hit.consecutiveRange;
        dateLabel = `${formatDayWeekdayShort(startYmd)} ~ ${formatDayWeekdayShort(endYmd)}`;
      } else {
        dateLabel = formatDayWeekdayShort(todayStr);
      }
    } else {
      dateLabel = formatDateLabel(todayStr);
    }
    out.push({
      displayName: m.displayName,
      recordIds: uniqueRecordIds(m.rows),
      dateLabel,
    });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
  return out;
}

/** 우측 패널: 연일 구간은 한 덩어리로 ~ 표시, 나머지 날짜는 개별 */
function formatSidebarMergedDateLine(merged: MergedVacationPerson): string {
  const rangeByKey = new Map<string, { startYmd: string; endYmd: string }>();
  for (const row of merged.rows) {
    const cr = row.consecutiveRange;
    if (!cr || cr.startYmd >= cr.endYmd) continue;
    rangeByKey.set(`${cr.startYmd}|${cr.endYmd}`, cr);
  }

  const covered = new Set<string>();
  const parts: { k: string; t: string }[] = [];

  for (const r of rangeByKey.values()) {
    const span = eachDayInclusive(r.startYmd, r.endYmd);
    if (span.length === 0) continue;
    if (!span.every((d) => merged.dateYmds.includes(d))) continue;
    parts.push({
      k: r.startYmd,
      t: `${formatDayWeekdayShort(r.startYmd)} ~ ${formatDayWeekdayShort(r.endYmd)}`,
    });
    for (const d of span) covered.add(d);
  }

  for (const d of merged.dateYmds) {
    if (!covered.has(d)) {
      parts.push({ k: d, t: formatDayWeekdayShort(d) });
    }
  }

  return parts
    .sort((a, b) => a.k.localeCompare(b.k))
    .map((p) => p.t)
    .join(", ");
}

interface TabVacationSegment {
  recordId: string;
  sortKey: string;
  daysYmd: string[];
  kindLabel: string;
  noteText: string;
}

function buildTabNoteText(rows: VacationFlatEntry[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const memo = rows[0]?.recordMemo?.trim();
  if (memo) {
    seen.add(memo);
    parts.push(memo);
  }
  for (const r of rows) {
    for (const t of [r.reason, r.note].filter(Boolean) as string[]) {
      const s = t.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        parts.push(s);
      }
    }
  }
  return parts.join(" · ") || "—";
}

/** 휴가 탭: 레코드별로 연일이면 구간 전체 날짜 + 구분·비고 */
function buildTabVacationSegments(merged: MergedVacationPerson): TabVacationSegment[] {
  const byRecord = new Map<string, VacationFlatEntry[]>();
  for (const row of merged.rows) {
    if (!byRecord.has(row.recordId)) byRecord.set(row.recordId, []);
    byRecord.get(row.recordId)!.push(row);
  }

  const out: TabVacationSegment[] = [];
  for (const [recordId, rows] of byRecord) {
    const first = rows[0];
    const kindLabel = first.vacationKind === "production" ? "제작" : "사무실";
    const cr = first.consecutiveRange;
    let daysYmd: string[];
    if (cr && cr.startYmd < cr.endYmd) {
      const span = eachDayInclusive(cr.startYmd, cr.endYmd);
      if (span.every((d) => rows.some((r) => r.dateYmd === d))) {
        daysYmd = span;
      } else {
        daysYmd = [...new Set(rows.map((r) => r.dateYmd))].sort();
      }
    } else {
      daysYmd = [...new Set(rows.map((r) => r.dateYmd))].sort();
    }
    out.push({
      recordId,
      sortKey: daysYmd[0] ?? "",
      daysYmd,
      kindLabel,
      noteText: buildTabNoteText(rows),
    });
  }
  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function TodayVacationBox({
  rows,
  todayStr,
  hideDeleteButtons,
  inlineEditMode,
  recordById,
}: {
  rows: TodayVacationRow[];
  todayStr: string;
  hideDeleteButtons?: boolean;
  inlineEditMode?: boolean;
  recordById?: Map<string, { summary: string; memo: string }>;
}) {
  const headerLabel = formatDateLabel(todayStr);

  return (
    <div className="w-full rounded-xl border border-[#5A2FB7]/50 bg-gradient-to-br from-[#5A2FB7]/20 via-[#4361DE]/10 to-black/70 p-2 shadow-md shadow-[#5A2FB7]/20">
      <p className="text-xs font-semibold text-white mb-1.5 px-1">{headerLabel}</p>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">오늘 예정된 휴가가 없습니다.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li
              key={`${r.displayName}-${i}`}
              className="rounded-lg bg-white/5 border border-[#5A2FB7]/30 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span className="text-sm font-semibold text-[#9cf0ff] whitespace-nowrap drop-shadow-[0_0_8px_rgba(120,200,255,0.35)]">{r.displayName}</span>
                  <span className="text-xs text-gray-300 leading-snug whitespace-nowrap">{r.dateLabel}</span>
                </div>
                {r.recordIds && r.recordIds.length > 0 && !hideDeleteButtons && !inlineEditMode && (
                  <div className="flex flex-wrap gap-1 justify-end shrink-0">
                    {r.recordIds.map((id) => (
                      <DeleteRecordButton key={id} recordId={id} className="scale-90 origin-right" />
                    ))}
                  </div>
                )}
              </div>
              {inlineEditMode &&
                r.recordIds &&
                r.recordIds.length > 0 &&
                recordById &&
                r.recordIds.map((id) => {
                  const rec = recordById.get(id);
                  if (!rec) return null;
                  return (
                    <div key={id} className="mt-2 border-t border-white/10 pt-2">
                      <InlineRecordEditor
                        recordId={id}
                        initialSummary={rec.summary}
                        initialMemo={rec.memo}
                        compact
                      />
                    </div>
                  );
                })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MergedVacationPersonCard({
  merged,
  dateMode,
  hideDeleteButtons,
  inlineEditMode,
  recordById,
}: {
  merged: MergedVacationPerson;
  /** sidebar: 연일은 ~ 한 줄 / tab: 날짜마다 모두 표시 */
  dateMode: "sidebar" | "tab";
  hideDeleteButtons?: boolean;
  inlineEditMode?: boolean;
  recordById?: Map<string, { summary: string; memo: string }>;
}) {
  const recordIds = uniqueRecordIds(merged.rows);
  const dateLine =
    dateMode === "sidebar"
      ? formatSidebarMergedDateLine(merged)
      : null;
  const tabSegments =
    dateMode === "tab" ? buildTabVacationSegments(merged) : [];

  return (
    <div className="bg-[#14141c] border border-white/10 rounded-lg hover:border-[#CD366D]/60 hover:shadow-md hover:shadow-[#CD366D]/20 transition-all overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          {dateMode === "sidebar" ? (
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-sm font-semibold text-white whitespace-nowrap">{merged.displayName}</span>
              <span className="text-xs text-gray-400 leading-snug whitespace-nowrap">{dateLine}</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">{merged.displayName}</p>
              <div className="mt-2 space-y-3">
                {tabSegments.map((seg) => (
                  <div key={seg.recordId} className="border-l-2 border-[#CD366D]/70 pl-2.5">
                    <ul className="space-y-0.5 list-none">
                      {seg.daysYmd.map((d) => (
                        <li key={d} className="text-xs text-gray-200">
                          {formatDateLabel(d)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs mt-1.5 text-gray-300">
                      <span className="text-gray-500">구분</span>{" "}
                      <span className="font-medium text-white">{seg.kindLabel}</span>
                    </p>
                    <p className="text-xs mt-0.5 text-gray-300">
                      <span className="text-gray-500">비고</span>{" "}
                      <span className="break-words">{seg.noteText}</span>
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {!hideDeleteButtons && !inlineEditMode && (
          <div className="flex flex-col gap-1 shrink-0">
            {recordIds.map((id) => (
              <DeleteRecordButton key={id} recordId={id} className="scale-95 origin-right" />
            ))}
          </div>
        )}
      </div>
      {inlineEditMode &&
        recordById &&
        recordIds.map((id) => {
          const rec = recordById.get(id);
          if (!rec) return null;
          return (
            <div key={id} className="border-t border-white/10 px-4 py-2">
              <InlineRecordEditor
                recordId={id}
                initialSummary={rec.summary}
                initialMemo={rec.memo}
                compact
              />
            </div>
          );
        })}
    </div>
  );
}

function PersonGroupedVacationSection({
  title,
  color,
  merged,
  dateMode,
  hideDeleteButtons,
  inlineEditMode,
  recordById,
}: {
  title: string;
  color: string;
  merged: MergedVacationPerson[];
  dateMode: "sidebar" | "tab";
  hideDeleteButtons?: boolean;
  inlineEditMode?: boolean;
  recordById?: Map<string, { summary: string; memo: string }>;
}) {
  if (merged.length === 0) {
    return (
      <div className="w-full rounded-xl border border-white/10 bg-white/5 p-2">
        <p className={`text-xs font-bold mb-1 px-1 ${color}`}>{title}</p>
        <p className="text-xs text-gray-600 text-center py-2">등록된 휴가 없음</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/5 p-2">
      <p className={`text-xs font-bold mb-1.5 px-1 ${color}`}>{title}</p>
      <div className="space-y-1">
        {merged.map((m) => (
          <MergedVacationPersonCard
            key={vacationPersonKey(m.rows[0])}
            merged={m}
            dateMode={dateMode}
            hideDeleteButtons={hideDeleteButtons}
            inlineEditMode={inlineEditMode}
            recordById={recordById}
          />
        ))}
      </div>
    </div>
  );
}

export default function VacationWeekView({
  vacationRecords,
  variant = "default",
  hideTitle = false,
  hideDeleteButtons = false,
  inlineEditMode = false,
}: {
  vacationRecords: ScheduleRecord[];
  /** sidebar: 우측 열 — 세로 스택, 스크롤 영역 */
  variant?: "default" | "sidebar";
  hideTitle?: boolean;
  /** true면 카드별 삭제 숨김(대시보드 통합 편집 등) */
  hideDeleteButtons?: boolean;
  /** true면 카드 안에서 요약·메모 수정(대시보드) */
  inlineEditMode?: boolean;
}) {
  const todayStr = getTodaySeoul();

  const recordById = useMemo(() => {
    const m = new Map<string, { summary: string; memo: string }>();
    for (const r of vacationRecords) {
      m.set(r.id, { summary: r.summary, memo: r.memo });
    }
    return m;
  }, [vacationRecords]);

  const officeFlat = useMemo(
    () => collectVacationFlat(vacationRecords, "office"),
    [vacationRecords]
  );
  const productionFlat = useMemo(
    () => collectVacationFlat(vacationRecords, "production"),
    [vacationRecords]
  );

  const officeMerged = useMemo(() => mergeVacationByPerson(officeFlat), [officeFlat]);
  const productionMerged = useMemo(() => mergeVacationByPerson(productionFlat), [productionFlat]);
  const combinedMerged = useMemo(
    () => mergeOfficeProductionLists(officeMerged, productionMerged),
    [officeMerged, productionMerged]
  );

  const dateMode = variant === "sidebar" ? "sidebar" : "tab";

  const todayRows = useMemo(
    () => buildTodayRows(combinedMerged, todayStr, variant === "sidebar"),
    [combinedMerged, todayStr, variant]
  );

  const allEmpty = officeFlat.length === 0 && productionFlat.length === 0;

  const rootClass = variant === "sidebar" ? "min-w-0" : "";

  return (
    <div className={rootClass}>
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-gray-200 mb-5">휴가 일정</h3>
      )}

      {allEmpty ? (
        <div className={`text-center text-gray-500 ${variant === "sidebar" ? "py-8" : "py-12"}`}>
          <p className="text-sm">등록된 휴가가 없습니다.</p>
          <p className="text-xs mt-1">
            <a href="/submit" className="text-[#9ab0ff] hover:underline">
              일정 업로드
            </a>
            에서 휴가를 등록해 주세요.
          </p>
        </div>
      ) : (
        <div className={variant === "sidebar" ? "space-y-1.5" : "space-y-4"}>
          <TodayVacationBox
            rows={todayRows}
            todayStr={todayStr}
            hideDeleteButtons={hideDeleteButtons}
            inlineEditMode={inlineEditMode}
            recordById={recordById}
          />

          <PersonGroupedVacationSection
            title="휴가"
            color="text-[#CD366D]"
            merged={combinedMerged}
            dateMode={dateMode}
            hideDeleteButtons={hideDeleteButtons}
            inlineEditMode={inlineEditMode}
            recordById={recordById}
          />
        </div>
      )}
    </div>
  );
}
