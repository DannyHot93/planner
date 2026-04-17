"use client";

import { useMemo, useState } from "react";
import {
  ScheduleRecord,
  CastingScheduleDetails,
  CastingEntry,
  VacationDetails,
  ScheduleEntry,
} from "@/lib/types";
import DeleteRecordButton from "./DeleteRecordButton";
import { toSeoulDateYmd } from "@/lib/seoul-week";

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

/** 짧은 날짜 표기 (카드·칩용) */
function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
  return `${m}/${d}(${wd})`;
}

function vacationKindOf(details: VacationDetails): "office" | "production" | "casting" {
  if (details.vacationKind === "production") return "production";
  if (details.vacationKind === "casting") return "casting";
  return "office";
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
}

interface CastingFlatEntry {
  dateYmd: string;
  person: string;
  dayReplacer?: string;
  nightReplacer?: string;
  note?: string;
  recordSummary: string;
  /** vacations.json에서 등록한 주조 휴가 — 삭제 버튼용 */
  recordId?: string;
  uploadedAt?: string;
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

interface MergedCastingPerson {
  person: string;
  dateYmds: string[];
  rows: CastingFlatEntry[];
}

type VacationKindTag = "office" | "production" | "casting";

interface TodayVacationRow {
  kind: VacationKindTag;
  displayName: string;
  /** 사무실·제작만 삭제용 */
  recordIds?: string[];
  /** 해당 일정 행이 등록된 시각 (ISO) — 오늘 칩 옆 등록일 표시용 */
  uploadedAt?: string;
}

function collectVacationFlat(
  vacationRecords: ScheduleRecord[],
  kind: "office" | "production"
): VacationFlatEntry[] {
  const rows: VacationFlatEntry[] = [];
  for (const record of vacationRecords) {
    const details = record.details as VacationDetails;
    if (vacationKindOf(details) !== kind) continue;

    const entries = Array.isArray(details.entries) ? details.entries : [];
    if (entries.length === 0) {
      rows.push({
        dateYmd: extractVacationDate({}, record),
        recordId: record.id,
        recordSummary: record.summary,
        recordMemo: record.memo,
        uploadedAt: record.uploadedAt,
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

function collectCastingFlat(castingRecords: ScheduleRecord[]): CastingFlatEntry[] {
  const rows: CastingFlatEntry[] = [];
  for (const record of castingRecords) {
    const details = record.details as CastingScheduleDetails;
    const entries: CastingEntry[] = Array.isArray(details.entries) ? details.entries : [];
    for (const entry of entries) {
      if (!entry.person || !entry.date) continue;
      const dateYmd = toSeoulDateYmd(entry.date) || entry.date.slice(0, 10);
      rows.push({
        dateYmd,
        person: entry.person,
        dayReplacer: entry.dayReplacer,
        nightReplacer: entry.nightReplacer,
        note: entry.note,
        recordSummary: record.summary,
      });
    }
  }
  return rows;
}

/** 휴가 폼(구분: 주조)으로 저장한 레코드 → 주조 열과 동일 형태로 병합 */
function collectCastingFlatFromVacations(vacationRecords: ScheduleRecord[]): CastingFlatEntry[] {
  const rows: CastingFlatEntry[] = [];
  for (const record of vacationRecords) {
    const details = record.details as VacationDetails;
    if (vacationKindOf(details) !== "casting") continue;
    const entries = Array.isArray(details.entries) ? details.entries : [];
    if (entries.length === 0) {
      const dateYmd = extractVacationDate({}, record);
      const person = (record.summary.split("·")[0] ?? "").trim() || "이름 미상";
      rows.push({
        dateYmd,
        person,
        note: record.memo || undefined,
        recordSummary: record.summary,
        recordId: record.id,
        uploadedAt: record.uploadedAt,
      });
    } else {
      for (const entry of entries) {
        const e = entry as ScheduleEntry;
        rows.push({
          dateYmd: extractVacationDate(e, record),
          person:
            typeof e.person === "string" && e.person.trim()
              ? e.person.trim()
              : "이름 미상",
          note:
            (typeof e.note === "string" && e.note) ||
            (typeof e.reason === "string" && e.reason) ||
            undefined,
          recordSummary: record.summary,
          recordId: record.id,
          uploadedAt: record.uploadedAt,
        });
      }
    }
  }
  return rows;
}

function uniqueCastingRecordIds(rows: CastingFlatEntry[]): string[] {
  const ids = rows.map((r) => r.recordId).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

function mergeCastingByPerson(rows: CastingFlatEntry[]): MergedCastingPerson[] {
  const map = new Map<string, MergedCastingPerson>();
  for (const row of rows) {
    const key = `n:${row.person.trim()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        person: row.person,
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
    return a.person.localeCompare(b.person, "ko");
  });
}

function uniqueRecordIds(rows: VacationFlatEntry[]): string[] {
  return [...new Set(rows.map((r) => r.recordId))];
}

function uploadedAtForTodayRow(
  rows: VacationFlatEntry[],
  todayStr: string
): string | undefined {
  const hit = rows.find((r) => r.dateYmd === todayStr);
  return hit?.uploadedAt;
}

function buildTodayRows(
  office: MergedVacationPerson[],
  production: MergedVacationPerson[],
  casting: MergedCastingPerson[],
  todayStr: string
): TodayVacationRow[] {
  const out: TodayVacationRow[] = [];

  for (const m of office) {
    if (!m.dateYmds.includes(todayStr)) continue;
    out.push({
      kind: "office",
      displayName: m.displayName,
      recordIds: uniqueRecordIds(m.rows),
      uploadedAt: uploadedAtForTodayRow(m.rows, todayStr),
    });
  }
  for (const m of production) {
    if (!m.dateYmds.includes(todayStr)) continue;
    out.push({
      kind: "production",
      displayName: m.displayName,
      recordIds: uniqueRecordIds(m.rows),
      uploadedAt: uploadedAtForTodayRow(m.rows, todayStr),
    });
  }
  for (const m of casting) {
    if (!m.dateYmds.includes(todayStr)) continue;
    out.push({ kind: "casting", displayName: m.person });
  }

  const kindOrder: Record<VacationKindTag, number> = {
    office: 0,
    production: 1,
    casting: 2,
  };
  out.sort((a, b) => {
    const k = kindOrder[a.kind] - kindOrder[b.kind];
    if (k !== 0) return k;
    return a.displayName.localeCompare(b.displayName, "ko");
  });
  return out;
}

const KIND_LABEL: Record<VacationKindTag, string> = {
  office: "사무실",
  production: "제작",
  casting: "주조",
};

const KIND_BADGE: Record<VacationKindTag, string> = {
  office: "bg-blue-100 text-blue-800",
  production: "bg-indigo-100 text-indigo-800",
  casting: "bg-orange-100 text-orange-900",
};

function TodayVacationBox({ rows, todayStr }: { rows: TodayVacationRow[]; todayStr: string }) {
  const label = formatDateLabel(todayStr);

  return (
    <div className="w-full rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">오늘의 휴가</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{label}</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-blue-600 text-white shrink-0">
          {rows.length}명
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">오늘 예정된 휴가가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={`${r.kind}-${r.displayName}-${i}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/80 border border-blue-100 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${KIND_BADGE[r.kind]}`}
                >
                  {KIND_LABEL[r.kind]}
                </span>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">{r.displayName}</span>
                  {r.uploadedAt && (
                    <span className="text-[10px] text-gray-400">
                      등록 {r.uploadedAt.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
              {r.recordIds && r.recordIds.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  {r.recordIds.map((id) => (
                    <DeleteRecordButton key={id} recordId={id} className="scale-90 origin-right" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DateChipList({ dateYmds, todayStr }: { dateYmds: string[]; todayStr: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {dateYmds.map((ymd) => (
        <span
          key={ymd}
          className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-lg ${
            ymd === todayStr
              ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {formatShortDate(ymd)}
        </span>
      ))}
    </div>
  );
}

function MergedVacationPersonCard({
  merged,
  todayStr,
}: {
  merged: MergedVacationPerson;
  todayStr: string;
}) {
  const [open, setOpen] = useState(false);
  const recordIds = uniqueRecordIds(merged.rows);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start justify-between gap-2 bg-white border border-green-200 rounded-xl px-4 py-3 hover:border-green-400 hover:shadow-sm transition-all cursor-default">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{merged.displayName}</p>
          <DateChipList dateYmds={merged.dateYmds} todayStr={todayStr} />
          {merged.rows.some((r) => r.reason) && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              {merged.rows
                .map((r) => r.reason)
                .filter(Boolean)
                .slice(0, 2)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {recordIds.map((id) => (
            <DeleteRecordButton key={id} recordId={id} className="scale-95 origin-right" />
          ))}
        </div>
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 max-h-64 overflow-y-auto bg-white border border-green-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-2">
          <p className="font-semibold text-green-800">{merged.displayName}</p>
          <p className="text-gray-500">
            {merged.dateYmds.map((d) => formatDateLabel(d)).join(", ")}
          </p>
          {merged.rows.map((entry, idx) => (
            <div key={`${entry.recordId}-${idx}`} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
              {entry.reason && (
                <p>
                  <span className="text-gray-400">사유</span> {entry.reason}
                </p>
              )}
              {entry.note && (
                <p>
                  <span className="text-gray-400">메모</span> {entry.note}
                </p>
              )}
              {entry.recordMemo && (
                <p>
                  <span className="text-gray-400">비고</span> {entry.recordMemo}
                </p>
              )}
              <p className="text-gray-300">업로드: {entry.uploadedAt.slice(0, 10)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MergedCastingPersonCard({
  merged,
  todayStr,
}: {
  merged: MergedCastingPerson;
  todayStr: string;
}) {
  const [open, setOpen] = useState(false);
  const showcaseRow = merged.rows.find((r) => r.dateYmd === todayStr) ?? merged.rows[0];
  const deletableRecordIds = uniqueCastingRecordIds(merged.rows);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 hover:border-orange-400 hover:shadow-sm transition-all cursor-default">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-orange-900 min-w-0 flex-1">{merged.person}</p>
          {deletableRecordIds.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end shrink-0">
              {deletableRecordIds.map((id) => (
                <DeleteRecordButton key={id} recordId={id} className="scale-90 origin-right" />
              ))}
            </div>
          )}
        </div>
        <DateChipList dateYmds={merged.dateYmds} todayStr={todayStr} />
        {(showcaseRow?.dayReplacer || showcaseRow?.nightReplacer) && (
          <div className="mt-2 space-y-0.5 text-xs">
            {showcaseRow.dayReplacer && (
              <p className="text-blue-700">
                <span className="text-gray-400">주간↗</span> {showcaseRow.dayReplacer}
              </p>
            )}
            {showcaseRow.nightReplacer && (
              <p className="text-indigo-700">
                <span className="text-gray-400">야간↗</span> {showcaseRow.nightReplacer}
              </p>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-orange-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-1.5">
          <p className="font-semibold text-orange-800">{merged.person} 휴가 (주조)</p>
          {merged.rows.map((entry, i) => (
            <div
              key={`${entry.recordId ?? "cast-sheet"}-${entry.dateYmd}-${i}`}
              className="border-t border-gray-100 pt-2 first:border-0 first:pt-0"
            >
              <p className="text-gray-600">{formatDateLabel(entry.dateYmd)}</p>
              <p className="text-gray-500 text-[11px]">{entry.recordSummary}</p>
              {entry.dayReplacer && (
                <p>
                  <span className="text-gray-400">대근(주간)</span>{" "}
                  <span className="text-blue-700 font-medium">{entry.dayReplacer}</span>
                </p>
              )}
              {entry.nightReplacer && (
                <p>
                  <span className="text-gray-400">대근(야간)</span>{" "}
                  <span className="text-indigo-700 font-medium">{entry.nightReplacer}</span>
                </p>
              )}
              {entry.note && (
                <p>
                  <span className="text-gray-400">비고</span> {entry.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonGroupedVacationSection({
  title,
  color,
  merged,
  todayStr,
}: {
  title: string;
  color: string;
  merged: MergedVacationPerson[];
  todayStr: string;
}) {
  if (merged.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className={`text-xs font-bold mb-2 ${color}`}>{title}</p>
        <p className="text-xs text-gray-300 text-center py-3">등록된 휴가 없음</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className={`text-xs font-bold mb-4 ${color}`}>{title}</p>
      <div className="space-y-3">
        {merged.map((m) => (
          <MergedVacationPersonCard key={vacationPersonKey(m.rows[0])} merged={m} todayStr={todayStr} />
        ))}
      </div>
    </div>
  );
}

function PersonGroupedCastingSection({
  merged,
  todayStr,
}: {
  merged: MergedCastingPerson[];
  todayStr: string;
}) {
  if (merged.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs font-bold mb-2 text-orange-700">주조 휴가</p>
        <p className="text-xs text-gray-300 text-center py-3">등록된 휴가 없음</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-bold mb-4 text-orange-700">주조 휴가</p>
      <div className="space-y-3">
        {merged.map((m) => (
          <MergedCastingPersonCard key={`cast-${m.person}`} merged={m} todayStr={todayStr} />
        ))}
      </div>
    </div>
  );
}

export default function VacationWeekView({
  vacationRecords,
  castingRecords,
  variant = "default",
  hideTitle = false,
}: {
  vacationRecords: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
  /** sidebar: 우측 열 — 세로 스택, 스크롤 영역 */
  variant?: "default" | "sidebar";
  hideTitle?: boolean;
}) {
  const todayStr = getTodaySeoul();

  const officeFlat = useMemo(
    () => collectVacationFlat(vacationRecords, "office"),
    [vacationRecords]
  );
  const productionFlat = useMemo(
    () => collectVacationFlat(vacationRecords, "production"),
    [vacationRecords]
  );
  const castingFlat = useMemo(() => {
    const fromVacationForm = collectCastingFlatFromVacations(vacationRecords);
    const fromCastingSheet = collectCastingFlat(castingRecords);
    return [...fromVacationForm, ...fromCastingSheet];
  }, [vacationRecords, castingRecords]);

  const officeMerged = useMemo(() => mergeVacationByPerson(officeFlat), [officeFlat]);
  const productionMerged = useMemo(() => mergeVacationByPerson(productionFlat), [productionFlat]);
  const castingMerged = useMemo(() => mergeCastingByPerson(castingFlat), [castingFlat]);

  const todayRows = useMemo(
    () => buildTodayRows(officeMerged, productionMerged, castingMerged, todayStr),
    [officeMerged, productionMerged, castingMerged, todayStr]
  );

  const allEmpty =
    officeFlat.length === 0 && productionFlat.length === 0 && castingFlat.length === 0;

  const gridClass =
    variant === "sidebar"
      ? "flex flex-col gap-4 items-stretch"
      : "grid grid-cols-1 sm:grid-cols-3 gap-4 items-start";

  const rootClass = variant === "sidebar" ? "min-w-0" : "";

  return (
    <div className={rootClass}>
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-gray-700 mb-5">휴가 일정</h3>
      )}

      {allEmpty ? (
        <div className={`text-center text-gray-400 ${variant === "sidebar" ? "py-8" : "py-12"}`}>
          <p className="text-sm">등록된 휴가가 없습니다.</p>
          <p className="text-xs mt-1">
            <a href="/submit" className="text-blue-500 hover:underline">
              일정 업로드
            </a>
            에서 휴가를 등록해 주세요.
          </p>
        </div>
      ) : (
        <div className={variant === "sidebar" ? "space-y-3" : "space-y-4"}>
          <TodayVacationBox rows={todayRows} todayStr={todayStr} />

          <div className={gridClass}>
            <div className="min-w-0">
              <PersonGroupedVacationSection
                title="사무실 휴가"
                color="text-blue-700"
                merged={officeMerged}
                todayStr={todayStr}
              />
            </div>
            <div className="min-w-0">
              <PersonGroupedVacationSection
                title="제작 휴가"
                color="text-indigo-700"
                merged={productionMerged}
                todayStr={todayStr}
              />
            </div>
            <div className="min-w-0">
              <PersonGroupedCastingSection merged={castingMerged} todayStr={todayStr} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
