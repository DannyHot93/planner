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
}

interface DayGroup {
  date: string;
  entries: EntryWithMeta[];
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

    if (entries.length === 0) {
      const date = extractDate({}, record);
      out.push({
        recordId: record.id,
        recordSummary: record.summary,
        recordMemo: record.memo,
        uploadedAt: record.uploadedAt,
        date,
        programTitle,
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

function EntryCard({
  entry,
  thisWeekMonday,
  hideRecordActions,
  inlineEditMode,
}: {
  entry: EntryWithMeta;
  thisWeekMonday: string;
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const headline =
    entry.programTitle ?? entry.note ?? entry.recordSummary;

  const entryDate = entry.date ? toSeoulDateYmd(entry.date) : "";
  const entryWeekMonday = entryDate
    ? mondayOfWeekContaining(entryDate)
    : thisWeekMonday;
  const isThisWeek = entryWeekMonday === thisWeekMonday;

  if (inlineEditMode) {
    const entryDateYmd = entry.date ? toSeoulDateYmd(entry.date) : "";
    const initialTitle =
      (entry.programTitle && String(entry.programTitle).trim()) ||
      (entry.note && String(entry.note).trim()) ||
      "";
    return (
      <div className="bg-white border border-blue-200 rounded-xl p-2 shadow-sm ring-1 ring-blue-100">
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

  return (
    <div
      className="relative group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-default hover:border-purple-300 hover:shadow-md transition-all">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <p
            className={`text-sm font-semibold leading-snug flex-1 min-w-0 ${
              isThisWeek ? "text-gray-900" : "text-gray-800"
            }`}
          >
            {headline}
          </p>
          {!hideRecordActions && (
            <DeleteRecordButton recordId={entry.recordId} className="shrink-0" />
          )}
        </div>
        {entry.time && (
          <p className="text-xs text-blue-600 font-medium mt-1">{entry.time}</p>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-purple-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-1.5">
          {entry.programTitle && (
            <p className="font-semibold text-sm text-gray-900">
              {entry.programTitle}
            </p>
          )}
          <p className="text-gray-600">{entry.recordSummary}</p>
          {entry.time && (
            <p>
              <span className="text-gray-400">시간</span>{" "}
              <span className="text-blue-600 font-medium">{entry.time}</span>
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
          <p className="text-gray-300 pt-1 border-t border-gray-100">
            업로드: {entry.uploadedAt.slice(0, 10)}
          </p>
        </div>
      )}
    </div>
  );
}

/** 이번 주 외: 한 블록 · 요일별 열 · 카드마다 날짜 표시 */
function OtherWeekMergedGrid({
  dayGroups,
  thisWeekMonday,
  hideRecordActions,
  inlineEditMode,
}: {
  dayGroups: DayGroup[];
  thisWeekMonday: string;
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-6 gap-2 overflow-x-auto pb-1">
      {dayGroups.map((group, idx) => {
        const isWeekendCol = idx === 5;
        const dayLabel = isWeekendCol ? "주말" : DAY_LABELS[idx];
        const isWeekend = isWeekendCol;

        return (
          <div
            key={group.date}
            className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-2 flex flex-col gap-2"
          >
            <div className="flex items-center justify-center px-1 py-0.5">
              <span
                className={`text-xs font-bold ${
                  isWeekend ? "text-red-500" : "text-gray-700"
                }`}
              >
                {dayLabel}
              </span>
            </div>

            {group.entries.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-3">일정 없음</p>
            ) : (
              <div className="flex flex-col gap-2">
                {group.entries.map((entry, i) => {
                  const ymd = entry.date ? toSeoulDateYmd(entry.date) : "";
                  return (
                    <div key={`${entry.recordId}-${ymd}-${i}`} className="flex flex-col gap-1">
                      <p className="text-[10px] font-semibold text-gray-500 leading-tight px-0.5">
                        {formatEntryDateLine(ymd)}
                      </p>
                      <EntryCard
                        entry={entry}
                        thisWeekMonday={thisWeekMonday}
                        hideRecordActions={hideRecordActions}
                        inlineEditMode={inlineEditMode}
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

function WeekGrid({
  dayGroups,
  todayStr,
  thisWeekMonday,
  weekDays,
  hideRecordActions,
  inlineEditMode,
}: {
  dayGroups: DayGroup[];
  todayStr: string;
  thisWeekMonday: string;
  /** 월~일 7개 YYYY-MM-DD (주말 열에서 토·일 표시용) */
  weekDays: string[];
  hideRecordActions?: boolean;
  inlineEditMode?: boolean;
}) {
  const satYmd = weekDays[5] ?? "";
  const sunYmd = weekDays[6] ?? "";

  return (
    <div className="grid w-full min-w-0 grid-cols-6 gap-2 overflow-x-auto pb-1">
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
            className={`min-w-0 rounded-xl border p-2 flex flex-col gap-2 ${
              isToday
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            {isWeekendCol ? (
              <div className="flex flex-col gap-1 px-0.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday ? "text-blue-600" : "text-red-500"
                    }`}
                  >
                    {dayLabel}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-[10px] leading-tight">
                  <span
                    className={
                      todayStr === satYmd
                        ? "font-semibold text-blue-600"
                        : "text-red-400"
                    }
                  >
                    토 {pad2(moSat)}/{pad2(daSat)}
                  </span>
                  <span
                    className={
                      todayStr === sunYmd
                        ? "font-semibold text-blue-600"
                        : "text-red-400"
                    }
                  >
                    일 {pad2(moSun)}/{pad2(daSun)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1">
                <span
                  className={`text-xs font-bold ${
                    isToday
                      ? "text-blue-600"
                      : isWeekend
                        ? "text-red-500"
                        : "text-gray-700"
                  }`}
                >
                  {dayLabel}
                </span>
                <span
                  className={`text-xs ${
                    isToday
                      ? "text-blue-500 font-semibold"
                      : isWeekend
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  {pad2(mo)}/{pad2(da)}
                </span>
              </div>
            )}

            {group.entries.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-3">일정 없음</p>
            ) : (
              group.entries.map((entry, i) => (
                <EntryCard
                  key={`${entry.recordId}-${group.date}-${i}`}
                  entry={entry}
                  thisWeekMonday={thisWeekMonday}
                  hideRecordActions={hideRecordActions}
                  inlineEditMode={inlineEditMode}
                />
              ))
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
}) {
  const todayStr = getTodaySeoul();
  /** 오늘이 속한 주의 월요일 — 제목 색(빨강) 기준 */
  const calendarThisWeekMonday = mondayOfWeekContaining(todayStr);

  const flat = useMemo(() => flattenRecordingEntries(records), [records]);

  const otherWeekByWeekday = useMemo(
    () => buildOtherWeekByWeekdayGroups(flat, calendarThisWeekMonday, todayStr),
    [flat, calendarThisWeekMonday, todayStr]
  );

  const hasOtherWeekAny = otherWeekByWeekday.some((g) => g.entries.length > 0);

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

  const thisWeekSectionClass = embedded
    ? "rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white p-3 shadow-sm"
    : "rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4 shadow-sm";
  const otherWeekSectionClass = embedded
    ? "rounded-xl border border-gray-200 bg-gray-50/80 p-3 shadow-sm"
    : "rounded-2xl border border-gray-200 bg-gray-50/90 p-4 shadow-sm";

  const emptyBlock = (
    <div className={`text-center py-8 text-gray-400 ${embedded ? "py-6" : "py-16"}`}>
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
                      <h4 className="text-sm font-bold text-blue-900">이번 주 일정</h4>
                      <span className="text-xs font-medium text-blue-700/80">
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
                  />
                </section>
              )}
            </>
          )}

          {showOther && (
            <>
              {hasOtherWeekAny ? (
                <section className={otherWeekSectionClass}>
                  {!embedded && (
                    <div className="mb-3">
                      <h4 className="text-sm font-bold text-gray-800">이번 주 외 일정</h4>
                    </div>
                  )}
                  <OtherWeekMergedGrid
                    dayGroups={otherWeekByWeekday}
                    thisWeekMonday={calendarThisWeekMonday}
                    hideRecordActions={hideRecordActions}
                    inlineEditMode={inlineEditMode}
                  />
                </section>
              ) : (
                sections !== "both" && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center">
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
