"use client";

import { useMemo, useState } from "react";
import { ScheduleRecord, ScheduleEntry } from "@/lib/types";
import {
  isSundayYmd,
  mondayOfWeekContaining,
  sevenDaysFromMonday,
  toSeoulDateYmd,
} from "@/lib/seoul-week";
import DeleteRecordButton from "./DeleteRecordButton";
import InlineRecordEditor from "./InlineRecordEditor";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** 월~일 7칸 → 월~금 + 주말(토·일 합침) 6칸 */
function mergeWeekendDayGroups(seven: DayGroup[]): DayGroup[] {
  if (seven.length !== 7) return seven;
  const sat = seven[5];
  const sun = seven[6];
  const entries = [...sat.entries, ...sun.entries].sort((a, b) => {
    const da = toSeoulDateYmd(a.date ?? "") || "";
    const db = toSeoulDateYmd(b.date ?? "") || "";
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return parseStartMinutes(a.time) - parseStartMinutes(b.time);
  });
  return [
    ...seven.slice(0, 5),
    {
      date: `weekend:${sat.date}:${sun.date}`,
      entries,
    },
  ];
}

/** Asia/Seoul 기준 오늘 날짜를 YYYY-MM-DD로 반환 */
function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

interface EntryWithMeta extends ScheduleEntry {
  recordId: string;
  recordSummary: string;
  recordMemo: string;
  uploadedAt: string;
  /** details.title / details.program */
  programTitle?: string;
  /** Google Calendar 등 API에서만 합쳐진 일정 — 삭제·인라인 수정 없음 */
  readonlyFromCalendar?: boolean;
}

interface DayGroup {
  date: string;
  entries: EntryWithMeta[];
}

interface MonthCalendarCell {
  date: string | null;
  entries: EntryWithMeta[];
}

interface MonthCalendar {
  label: string;
  cells: MonthCalendarCell[];
}

/** entries[].date가 없으면 period 첫 날짜, 없으면 업로드일(서울 달력) */
function extractDate(entry: ScheduleEntry, record: ScheduleRecord): string {
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

function parseStartMinutes(time?: string): number {
  if (!time) return 0;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** 모든 녹화 엔트리를 평탄화 (주·날짜 필터 전) */
function flattenRecordingEntries(records: ScheduleRecord[]): EntryWithMeta[] {
  const out: EntryWithMeta[] = [];
  for (const record of records) {
    const details = record.details as {
      entries?: ScheduleEntry[];
      title?: string;
      program?: string;
    };
    const programTitle = details.title ?? details.program;
    const entries = Array.isArray(details.entries) ? details.entries : [];
    const readonlyFromCalendar = record.id.startsWith("gcal_");

    if (entries.length === 0) {
      const date = extractDate({}, record);
      out.push({
        recordId: record.id,
        recordSummary: record.summary,
        recordMemo: record.memo,
        uploadedAt: record.uploadedAt,
        date,
        programTitle,
        readonlyFromCalendar,
      });
    } else {
      for (const entry of entries) {
        const date = extractDate(entry, record);
        out.push({
          ...entry,
          date,
          recordId: record.id,
          recordSummary: record.summary,
          recordMemo: record.memo,
          uploadedAt: record.uploadedAt,
          programTitle,
          readonlyFromCalendar,
        });
      }
    }
  }
  return out;
}

function buildDayGroupsFromFlat(
  flat: EntryWithMeta[],
  weekDays: string[]
): DayGroup[] {
  const weekSet = new Set(weekDays);
  const map = new Map<string, EntryWithMeta[]>();
  weekDays.forEach((d) => map.set(d, []));

  for (const entry of flat) {
    const date = entry.date ? toSeoulDateYmd(entry.date) : "";
    if (!date || !weekSet.has(date)) continue;
    map.get(date)!.push(entry);
  }

  return weekDays.map((date) => ({
    date,
    entries: (map.get(date) ?? []).sort(
      (a, b) => parseStartMinutes(a.time) - parseStartMinutes(b.time)
    ),
  }));
}

function formatRangeLabel(weekDays: string[]): string {
  if (weekDays.length < 2) return weekDays[0] ?? "";
  return `${weekDays[0]} ~ ${weekDays[6]}`;
}

/**
 * Asia/Seoul 달력 날짜(YYYY-MM-DD)가 금요일이면서, 그 달의 둘째·넷째 금요일인지.
 * (가족의 날/반일 등 4.5일 근무 안내용)
 */
function isSecondOrFourthFriday(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return false;
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 5) return false;
  let firstFriday = 0;
  for (let day = 1; day <= 7; day++) {
    if (new Date(Date.UTC(y, m - 1, day)).getUTCDay() === 5) {
      firstFriday = day;
      break;
    }
  }
  if (firstFriday === 0) return false;
  const n = Math.floor((d - firstFriday) / 7) + 1;
  return n === 2 || n === 4;
}

/** YYYY-MM-DD → 월~일 열 인덱스 (월=0 … 일=6) */
function weekdayColumnIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const sun0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (sun0 + 6) % 7;
}

/** 카드 위 날짜 한 줄 */
function formatEntryDateLine(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  ];
  return `${mo}/${d} (${wd})`;
}

function formatMonthTitle(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return `${y}년 ${m}월`;
}

function hasCalendarEntries(calendar: MonthCalendar): boolean {
  return calendar.cells.some((cell) => cell.entries.length > 0);
}

/**
 * 이번 주 제외 일정을 요일 7칸으로 묶음.
 * 월~토에는 지난주 이전(과거) 일정을 숨겨 사용자가 보기에 "월요일부터 지난주가 깔끔히 사라진" 상태를 만든다.
 * 일요일 당일은 그 주가 끝나기 전이라 지난주도 그대로 표시(클린업 정책과 동일).
 */
function buildOtherWeekByWeekdayGroups(
  flat: EntryWithMeta[],
  calendarThisWeekMonday: string,
  todayYmd: string
): DayGroup[] {
  const hidePast = !isSundayYmd(todayYmd);
  const buckets: EntryWithMeta[][] = [[], [], [], [], [], [], []];
  for (const e of flat) {
    const d = e.date ? toSeoulDateYmd(e.date) : "";
    if (!d) continue;
    if (mondayOfWeekContaining(d) === calendarThisWeekMonday) continue;
    if (hidePast && d < calendarThisWeekMonday) continue;
    const col = weekdayColumnIndex(d);
    buckets[col].push({ ...e, date: d });
  }
  for (const b of buckets) {
    b.sort((a, x) => {
      const c = (a.date ?? "").localeCompare(x.date ?? "");
      if (c !== 0) return c;
      return parseStartMinutes(a.time) - parseStartMinutes(x.time);
    });
  }
  const weekendMerged = [...buckets[5], ...buckets[6]].sort((a, x) => {
    const c = (a.date ?? "").localeCompare(x.date ?? "");
    if (c !== 0) return c;
    return parseStartMinutes(a.time) - parseStartMinutes(x.time);
  });
  return [
    { date: "other-weekday-0", entries: buckets[0] },
    { date: "other-weekday-1", entries: buckets[1] },
    { date: "other-weekday-2", entries: buckets[2] },
    { date: "other-weekday-3", entries: buckets[3] },
    { date: "other-weekday-4", entries: buckets[4] },
    { date: "other-weekend", entries: weekendMerged },
  ];
}

function addMonthsToMonthKey(ymd: string, offset: number): string {
  const [year, month] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function buildMonthCalendar(
  flat: EntryWithMeta[],
  todayYmd: string,
  monthOffset: number
): MonthCalendar {
  const monthKey = addMonthsToMonthKey(todayYmd, monthOffset);
  const [year, month] = monthKey.split("-").map(Number);
  const firstDate = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = weekdayColumnIndex(firstDate);
  const byDate = new Map<string, EntryWithMeta[]>();

  for (const e of flat) {
    const d = e.date ? toSeoulDateYmd(e.date) : "";
    if (!d || !d.startsWith(`${monthKey}-`)) continue;
    const entries = byDate.get(d) ?? [];
    entries.push({ ...e, date: d });
    byDate.set(d, entries);
  }

  const cells: MonthCalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ date: null, entries: [] });
  }
  for (let day = 1; day <= lastDay; day++) {
    const date = `${monthKey}-${pad2(day)}`;
    cells.push({
      date,
      entries: (byDate.get(date) ?? []).sort(
        (a, b) => parseStartMinutes(a.time) - parseStartMinutes(b.time)
      ),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, entries: [] });
  }

  return {
    label: formatMonthTitle(firstDate),
    cells,
  };
}

function EntryDetailPopover({
  entry,
  timeColor,
}: {
  entry: EntryWithMeta;
  timeColor: string;
}) {
  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-72 rounded-xl bg-gradient-to-br from-[#323a52] to-[#252b3d] p-4 text-xs text-gray-200 space-y-1.5 shadow-xl shadow-black/40 ring-1 ring-white/10">
      {entry.programTitle && (
        <p className="font-semibold text-sm text-white">
          {entry.programTitle}
        </p>
      )}
      <p className="text-gray-300">{entry.recordSummary}</p>
      {entry.date && (
        <p>
          <span className="text-gray-400">날짜</span>{" "}
          <span className="font-medium text-gray-100">{formatEntryDateLine(toSeoulDateYmd(entry.date) || entry.date)}</span>
        </p>
      )}
      {entry.time && (
        <p>
          <span className="text-gray-400">시간</span>{" "}
          <span className={`font-medium ${timeColor}`}>{entry.time}</span>
        </p>
      )}
      {entry.place && (
        <p>
          <span className="text-gray-400">장소</span> {entry.place}
        </p>
      )}
      {entry.person && (
        <p>
          <span className="text-gray-400">담당</span> {entry.person}
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
      <p className="text-gray-500 pt-1 border-t border-white/10">
        업로드: {entry.uploadedAt.slice(0, 10)}
      </p>
    </div>
  );
}

function EntryCard({
  entry,
  thisWeekMonday,
  hideRecordActions,
  inlineEditMode,
  variant = "this-week",
  accentToday = false,
  displayMode = false,
}: {
  entry: EntryWithMeta;
  thisWeekMonday: string;
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
  variant?: "this-week" | "other-week";
  /** 방송일(열)이 오늘인 경우 제목 강조 */
  accentToday?: boolean;
  displayMode?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const headline =
    entry.programTitle ?? entry.note ?? entry.recordSummary;

  const entryDate = entry.date ? toSeoulDateYmd(entry.date) : "";
  const entryWeekMonday = entryDate
    ? mondayOfWeekContaining(entryDate)
    : thisWeekMonday;
  const isThisWeek = entryWeekMonday === thisWeekMonday;

  if (inlineEditMode && !entry.readonlyFromCalendar) {
    const entryDateYmd = entry.date ? toSeoulDateYmd(entry.date) : "";
    const initialTitle =
      (entry.programTitle && String(entry.programTitle).trim()) ||
      (entry.note && String(entry.note).trim()) ||
      "";
    return (
      <div className="rounded-xl bg-gradient-to-br from-[#323a52]/95 to-[#252b3d] p-2">
        <InlineRecordEditor
          recordId={entry.recordId}
          initialSummary={entry.recordSummary}
          initialMemo={entry.recordMemo}
          compact
          scheduleFields={{
            initialTitle,
            initialTime: entry.time ?? "",
            entryDateYmd: entryDateYmd || undefined,
          }}
        />
      </div>
    );
  }

  const cardSurface =
    displayMode
      ? variant === "this-week"
        ? "bg-[#252b3d]"
        : "bg-[#2a222c]"
      : variant === "this-week"
      ? "bg-gradient-to-br from-[#323a52]/95 to-[#252b3d]"
      : "bg-gradient-to-br from-[#3d2f3a]/95 to-[#2a222c]";
  const timeColor =
    accentToday && variant === "this-week"
      ? "text-gray-200 font-semibold"
      : accentToday && variant === "other-week"
        ? "text-gray-200 font-semibold"
        : variant === "this-week"
          ? "text-gray-300"
          : "text-gray-300";
  const cardClass = displayMode
    ? `rounded-lg p-3 cursor-default ${cardSurface}`
    : `rounded-xl p-3 cursor-default ${cardSurface}`;
  const headlineClass = displayMode
    ? `text-[28px] leading-tight flex-1 min-w-0 break-words ${
        accentToday
          ? "font-bold text-yellow-300"
          : "font-semibold text-white"
      }`
    : `text-sm leading-snug flex-1 min-w-0 break-words tracking-tight ${
        accentToday
          ? "font-bold text-yellow-300"
          : "font-semibold text-white"
      }`;
  const timeClass = displayMode
    ? `text-[22px] leading-tight font-semibold mt-2 ${timeColor}`
    : `text-xs font-medium mt-1 ${timeColor}`;

  return (
    <div
      className="relative group"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        setOpen((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        } else if (e.key === "Escape") {
          setOpen(false);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <p className={headlineClass}>
            {headline}
          </p>
          {!hideRecordActions && !entry.readonlyFromCalendar && (
            <DeleteRecordButton recordId={entry.recordId} className="shrink-0" />
          )}
        </div>
        {entry.time && (
          <p className={timeClass}>{entry.time}</p>
        )}
      </div>

      {open && <EntryDetailPopover entry={entry} timeColor={timeColor} />}
    </div>
  );
}

/** 이번 주 외: 한 블록 · 요일별 열 · 카드마다 날짜 표시 */
function OtherWeekMergedGrid({
  dayGroups,
  thisWeekMonday,
  todayStr,
  hideRecordActions,
  inlineEditMode,
  displayMode = false,
}: {
  dayGroups: DayGroup[];
  thisWeekMonday: string;
  todayStr: string;
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
  displayMode?: boolean;
}) {
  const gridClass = displayMode
    ? "grid w-full grid-cols-6 gap-2 pb-1"
    : "grid w-full min-w-0 grid-cols-6 gap-2 overflow-x-auto pb-1";
  const columnClass = displayMode
    ? "rounded-lg border border-[#CD366D]/25 bg-[#100b10] p-2 flex flex-col gap-2 min-h-[260px]"
    : "min-w-0 rounded-xl border border-[#CD366D]/20 bg-black/40 p-2 flex flex-col gap-2";
  const dayLabelClass = displayMode ? "text-xl" : "text-xs";
  const emptyClass = displayMode
    ? "text-lg text-gray-600 text-center py-3"
    : "text-xs text-gray-600 text-center py-3";
  const entryDateClass = displayMode
    ? "text-lg font-semibold text-[#f7a7c1]/75 leading-tight px-0.5"
    : "text-[10px] font-semibold text-[#f7a7c1]/70 leading-tight px-0.5";

  return (
    <div className={gridClass}>
      {dayGroups.map((group, idx) => {
        const isWeekendCol = idx === 5;
        const dayLabel = isWeekendCol ? "주말" : DAY_LABELS[idx];
        const isWeekend = isWeekendCol;

        return (
          <div
            key={group.date}
            className={columnClass}
          >
            <div className="flex items-center justify-center px-1 py-0.5">
              <span
                className={`${dayLabelClass} font-bold ${
                  isWeekend ? "text-[#f7a7c1]" : "text-gray-200"
                }`}
              >
                {dayLabel}
              </span>
            </div>

            {group.entries.length === 0 ? (
              <p className={emptyClass}>일정 없음</p>
            ) : (
              <div className="flex flex-col gap-2">
                {group.entries.map((entry, i) => {
                  const ymd = entry.date ? toSeoulDateYmd(entry.date) : "";
                  return (
                    <div key={`${entry.recordId}-${ymd}-${i}`} className="flex flex-col gap-1">
                      <p className={entryDateClass}>
                        {formatEntryDateLine(ymd)}
                      </p>
                      <EntryCard
                        entry={entry}
                        thisWeekMonday={thisWeekMonday}
                        hideRecordActions={hideRecordActions}
                        inlineEditMode={inlineEditMode}
                        variant="other-week"
                        accentToday={Boolean(ymd && ymd === todayStr)}
                        displayMode={displayMode}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthCalendarMiniEntry({
  entry,
  accentToday,
}: {
  entry: EntryWithMeta;
  accentToday: boolean;
}) {
  const [open, setOpen] = useState(false);
  const headline = entry.programTitle ?? entry.note ?? entry.recordSummary;
  const timeColor = accentToday
    ? "text-yellow-100 font-semibold"
    : "text-gray-300";
  return (
    <div
      className={`relative rounded px-1.5 py-1 cursor-default ${
        accentToday ? "bg-yellow-300/20" : "bg-[#2a222c]"
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        } else if (e.key === "Escape") {
          setOpen(false);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <p
        className={`truncate text-[12px] font-semibold leading-tight ${
          accentToday ? "text-yellow-200" : "text-white"
        }`}
      >
        {headline}
      </p>
      {entry.time && (
        <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-gray-300">
          {entry.time}
        </p>
      )}
      {open && <EntryDetailPopover entry={entry} timeColor={timeColor} />}
    </div>
  );
}

function OtherWeekCurrentMonthCalendarGrid({
  calendar,
  todayStr,
}: {
  calendar: MonthCalendar;
  todayStr: string;
}) {
  const entryCount = calendar.cells.reduce((sum, cell) => sum + cell.entries.length, 0);
  return (
    <div className="rounded-lg border border-[#CD366D]/25 bg-[#100b10] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <h5 className="text-base font-bold text-[#f7a7c1]">{calendar.label}</h5>
        <span className="text-[11px] font-semibold text-[#f7a7c1]/70">
          전체 {entryCount}건
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`rounded border border-white/5 bg-black/35 py-0.5 text-center text-[11px] font-bold ${
              idx >= 5 ? "text-[#f7a7c1]" : "text-gray-300"
            }`}
          >
            {label}
          </div>
        ))}
        {calendar.cells.map((cell, idx) => {
          const isToday = cell.date === todayStr;
          const day = cell.date ? Number(cell.date.slice(8, 10)) : null;
          return (
            <div
              key={`${cell.date ?? "blank"}-${idx}`}
              className={`min-h-[70px] rounded border p-1 ${
                cell.date
                  ? isToday
                    ? "border-yellow-300/70 bg-yellow-300/10"
                    : "border-[#CD366D]/20 bg-black/30"
                  : "border-white/5 bg-black/10"
              }`}
            >
              {cell.date && (
                <>
                  <p
                    className={`mb-0.5 text-[12px] font-bold leading-tight ${
                      isToday ? "text-yellow-300" : "text-[#f7a7c1]/80"
                    }`}
                  >
                    {day}
                  </p>
                  <div className="flex flex-col gap-1">
                    {cell.entries.slice(0, 2).map((entry, i) => (
                      <MonthCalendarMiniEntry
                        key={`${entry.recordId}-${cell.date}-${i}`}
                        entry={entry}
                        accentToday={isToday}
                      />
                    ))}
                    {cell.entries.length > 2 && (
                      <p className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-gray-300">
                        +{cell.entries.length - 2}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthCalendarStack({
  calendars,
  todayStr,
}: {
  calendars: MonthCalendar[];
  todayStr: string;
}) {
  return (
    <div className="space-y-3">
      {calendars.map((calendar) => (
        <OtherWeekCurrentMonthCalendarGrid
          key={calendar.label}
          calendar={calendar}
          todayStr={todayStr}
        />
      ))}
    </div>
  );
}

function WeekGrid({
  dayGroups,
  todayStr,
  thisWeekMonday,
  weekDays,
  hideRecordActions,
  inlineEditMode,
  displayMode = false,
}: {
  dayGroups: DayGroup[];
  todayStr: string;
  thisWeekMonday: string;
  /** 월~일 7개 YYYY-MM-DD (주말 열에서 토·일 표시용) */
  weekDays: string[];
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
  displayMode?: boolean;
}) {
  const satYmd = weekDays[5] ?? "";
  const sunYmd = weekDays[6] ?? "";
  const gridClass = displayMode
    ? "grid w-full grid-cols-6 gap-2 pb-1"
    : "grid w-full min-w-0 grid-cols-6 gap-2 overflow-x-auto pb-1";
  const dayLabelClass = displayMode ? "text-xl" : "text-xs";
  const dateLabelClass = displayMode ? "text-xl" : "text-xs";
  const weekendDateClass = displayMode
    ? "flex flex-col gap-0.5 text-lg leading-tight"
    : "flex flex-col gap-0.5 text-[10px] leading-tight";
  const fridayNoteClass = displayMode
    ? "text-base font-semibold text-amber-300/90 mt-0.5 text-right"
    : "text-[10px] font-semibold text-amber-300/90 mt-0.5 text-right";
  const emptyClass = displayMode
    ? "text-lg text-gray-600 text-center py-3"
    : "text-xs text-gray-600 text-center py-3";

  return (
    <div className={gridClass}>
      {dayGroups.map((group, idx) => {
        const isWeekendCol = idx === 5;
        const isToday = isWeekendCol
          ? todayStr === satYmd || todayStr === sunYmd
          : group.date === todayStr;
        const [, mo, da] = group.date.split("-").map(Number);
        const dayLabel = isWeekendCol ? "주말" : DAY_LABELS[idx];
        const isWeekend = isWeekendCol;

        const [, moSat, daSat] = satYmd.split("-").map(Number);
        const [, moSun, daSun] = sunYmd.split("-").map(Number);

        return (
          <div
            key={group.date}
            className={`rounded-xl border p-2 flex flex-col gap-2 ${
              displayMode ? "" : "min-w-0"
            } ${
              isToday
                ? "border-[#4361DE] bg-[#4361DE]/20"
                : "border-[#4361DE]/20 bg-black/40"
            }`}
          >
            {isWeekendCol ? (
              <div className="flex flex-col gap-1 px-0.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`${dayLabelClass} font-bold ${
                      isToday ? "text-[#9ab0ff]" : "text-[#f7a7c1]"
                    }`}
                  >
                    {dayLabel}
                  </span>
                </div>
                <div className={weekendDateClass}>
                  <span
                    className={
                      todayStr === satYmd
                        ? "font-semibold text-[#9ab0ff]"
                        : "text-[#f7a7c1]/80"
                    }
                  >
                    토 {pad2(moSat)}/{pad2(daSat)}
                  </span>
                  <span
                    className={
                      todayStr === sunYmd
                        ? "font-semibold text-[#9ab0ff]"
                        : "text-[#f7a7c1]/80"
                    }
                  >
                    일 {pad2(moSun)}/{pad2(daSun)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`${dayLabelClass} font-bold ${
                      isToday
                        ? "text-[#9ab0ff]"
                        : isWeekend
                          ? "text-[#f7a7c1]"
                          : "text-gray-200"
                    }`}
                  >
                    {dayLabel}
                  </span>
                  <span
                    className={`${dateLabelClass} ${
                      isToday
                        ? "text-[#9ab0ff] font-semibold"
                        : isWeekend
                          ? "text-[#f7a7c1]/80"
                          : "text-gray-500"
                    }`}
                  >
                    {pad2(mo)}/{pad2(da)}
                  </span>
                </div>
                {idx === 4 && isSecondOrFourthFriday(group.date) && (
                  <p className={fridayNoteClass}>
                    4.5일
                  </p>
                )}
              </div>
            )}

            {group.entries.length === 0 ? (
              <p className={emptyClass}>일정 없음</p>
            ) : (
              group.entries.map((entry, i) => {
                const ymd = entry.date ? toSeoulDateYmd(entry.date) : "";
                const accentToday = Boolean(ymd && ymd === todayStr);
                return (
                  <EntryCard
                    key={`${entry.recordId}-${group.date}-${i}`}
                    entry={entry}
                    thisWeekMonday={thisWeekMonday}
                    hideRecordActions={hideRecordActions}
                    inlineEditMode={inlineEditMode}
                    variant="this-week"
                    accentToday={accentToday}
                    displayMode={displayMode}
                  />
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RecordingWeekView({
  records,
  sections = "both",
  embedded = false,
  hideRecordActions = false,
  inlineEditMode = false,
  displayMode = false,
  calendarMode = false,
  displayCalendarMonthOffset = 0,
  includeNextMonthCalendar = false,
}: {
  records: ScheduleRecord[];
  /** both: 이번 주 + 이번 주 외. 대시보드에서는 열마다 분리 */
  sections?: "both" | "this-week" | "other-week";
  /** true면 카드 테두리·여백 최소화(그리드 상위에서 제목과 함께 사용) */
  embedded?: boolean;
  /** true면 카드별 삭제 숨김(대시보드 통합 편집 등) */
  hideRecordActions?: boolean;
  /** true면 카드 안에서 요약·메모 수정(대시보드) */
  inlineEditMode?: boolean;
  /** true면 Samsung Flip Pro/Tizen 내장 브라우저용 단순 표시 클래스 사용 */
  displayMode?: boolean;
  /** true면 이번 주 외 영역을 월간 달력으로 표시 */
  calendarMode?: boolean;
  /** displayMode 월간 달력에서 오늘 기준 몇 개월 뒤를 표시할지 */
  displayCalendarMonthOffset?: number;
  /** true면 월간 달력 모드에서 다음달 일정이 있을 때 다음달 달력도 함께 표시 */
  includeNextMonthCalendar?: boolean;
}) {
  const todayStr = getTodaySeoul();
  /** 오늘이 속한 주의 월요일 — 제목 색(빨강) 기준 */
  const calendarThisWeekMonday = mondayOfWeekContaining(todayStr);

  const flat = useMemo(() => flattenRecordingEntries(records), [records]);

  const otherWeekByWeekday = useMemo(
    () => buildOtherWeekByWeekdayGroups(flat, calendarThisWeekMonday, todayStr),
    [flat, calendarThisWeekMonday, todayStr]
  );
  const displayMonthCalendar = useMemo(
    () => buildMonthCalendar(flat, todayStr, displayCalendarMonthOffset),
    [flat, todayStr, displayCalendarMonthOffset]
  );
  const nextMonthCalendar = useMemo(
    () => buildMonthCalendar(flat, todayStr, 1),
    [flat, todayStr]
  );

  const hasOtherWeekAny = otherWeekByWeekday.some((g) => g.entries.length > 0);
  const calendarList = useMemo(() => {
    if (!includeNextMonthCalendar || !hasCalendarEntries(nextMonthCalendar)) {
      return [displayMonthCalendar];
    }
    return [displayMonthCalendar, nextMonthCalendar];
  }, [displayMonthCalendar, includeNextMonthCalendar, nextMonthCalendar]);

  const thisWeekDays = sevenDaysFromMonday(calendarThisWeekMonday);
  const thisWeekGroups = useMemo(() => {
    const days = sevenDaysFromMonday(calendarThisWeekMonday);
    const seven = buildDayGroupsFromFlat(flat, days);
    return mergeWeekendDayGroups(seven);
  }, [flat, calendarThisWeekMonday]);

  const hasAny = flat.length > 0;

  const showBoth = sections === "both";
  const showThis = sections === "both" || sections === "this-week";
  const showOther = sections === "both" || sections === "other-week";
  const showCalendar = displayMode || calendarMode;

  const thisWeekSectionClass = embedded
    ? displayMode
      ? "rounded-lg border border-[#4361DE]/40 bg-[#0e0e14] p-2"
      : "rounded-xl border border-[#4361DE]/40 bg-[#0e0e14]/80 p-3"
    : "rounded-2xl border border-[#4361DE]/40 bg-gradient-to-b from-[#4361DE]/15 to-[#0e0e14]/95 p-4";
  const otherWeekSectionClass = embedded
    ? displayMode
      ? "rounded-lg border border-[#CD366D]/40 bg-[#0e0e14] p-2"
      : "rounded-xl border border-[#CD366D]/40 bg-[#0e0e14]/80 p-3"
    : "rounded-2xl border border-[#CD366D]/40 bg-gradient-to-b from-[#CD366D]/15 to-[#0e0e14]/95 p-4";

  const emptyBlock = (
    <div className={`text-center py-8 text-gray-500 ${embedded ? "py-6" : "py-16"}`}>
      {!embedded && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
      )}
      <p className="text-sm">표시할 일정이 없습니다.</p>
      {!embedded && (
        <p className="text-xs mt-1">
          <a href="/submit" className="text-blue-500 hover:underline">
            일정 업로드
          </a>
          에서 등록해 보세요.
        </p>
      )}
    </div>
  );

  return (
    <div className={embedded ? "space-y-0" : "space-y-8"}>
      {!hasAny && showBoth ? (
        emptyBlock
      ) : !hasAny && showThis ? (
        emptyBlock
      ) : !hasAny && showOther ? (
        emptyBlock
      ) : (
        <>
          {showThis && (
            <>
              {!hasAny ? (
                emptyBlock
              ) : (
                <section className={thisWeekSectionClass}>
                  {!embedded && (
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h4 className="text-sm font-bold text-[#9ab0ff]">이번 주 일정</h4>
                      <span className="text-xs font-medium text-[#9ab0ff]/80">
                        {formatRangeLabel(thisWeekDays)}
                      </span>
                    </div>
                  )}
                  <WeekGrid
                    dayGroups={thisWeekGroups}
                    todayStr={todayStr}
                    thisWeekMonday={calendarThisWeekMonday}
                    weekDays={thisWeekDays}
                    hideRecordActions={hideRecordActions}
                    inlineEditMode={inlineEditMode}
                    displayMode={displayMode}
                  />
                </section>
              )}
            </>
          )}

          {showOther && (
            <>
              {showCalendar || hasOtherWeekAny ? (
                <section className={otherWeekSectionClass}>
                  {!embedded && (
                    <div className="mb-3">
                      <h4 className="text-sm font-bold text-[#f7a7c1]">이번 주 외 일정</h4>
                    </div>
                  )}
                  {showCalendar ? (
                    <MonthCalendarStack
                      calendars={calendarList}
                      todayStr={todayStr}
                    />
                  ) : hasOtherWeekAny ? (
                    <OtherWeekMergedGrid
                      dayGroups={otherWeekByWeekday}
                      thisWeekMonday={calendarThisWeekMonday}
                      todayStr={todayStr}
                      hideRecordActions={hideRecordActions}
                      inlineEditMode={inlineEditMode}
                      displayMode={displayMode}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-xs text-gray-400">이번 주 외로 잡힌 일정이 없습니다.</p>
                    </div>
                  )}
                </section>
              ) : (
                sections !== "both" && (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-xs text-gray-400">이번 주 외로 잡힌 일정이 없습니다.</p>
                  </div>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
