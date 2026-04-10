"use client";

import { useState } from "react";
import { ScheduleRecord, ScheduleEntry } from "@/lib/types";
import {
  mondayOfWeekContaining,
  sevenDaysFromMonday,
} from "@/lib/seoul-week";
import DeleteRecordButton from "./DeleteRecordButton";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

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
  programTitle?: string;
}

interface DayGroup {
  date: string;
  entries: EntryWithMeta[];
}

/** entries[].date가 없으면 period 첫 날짜, 없으면 업로드일 */
function extractDate(entry: ScheduleEntry, record: ScheduleRecord): string {
  if (entry.date) return entry.date.slice(0, 10);
  const details = record.details as { period?: string | null };
  if (details.period) {
    const match = String(details.period).match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return record.uploadedAt.slice(0, 10);
}

function parseStartMinutes(time?: string): number {
  if (!time) return 0;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function collectEntryDates(records: ScheduleRecord[]): string[] {
  const dates: string[] = [];
  for (const record of records) {
    const details = record.details as { entries?: ScheduleEntry[] };
    const entries = Array.isArray(details.entries) ? details.entries : [];
    if (entries.length === 0) {
      dates.push(extractDate({}, record));
    } else {
      for (const e of entries) {
        dates.push(extractDate(e, record));
      }
    }
  }
  return [...new Set(dates)].sort();
}

function buildDayGroups(
  records: ScheduleRecord[],
  weekDays: string[]
): DayGroup[] {
  const weekSet = new Set(weekDays);
  const map = new Map<string, EntryWithMeta[]>();
  weekDays.forEach((d) => map.set(d, []));

  for (const record of records) {
    const details = record.details as {
      entries?: ScheduleEntry[];
      title?: string;
    };
    const programTitle = details.title;
    const entries = Array.isArray(details.entries) ? details.entries : [];

    if (entries.length === 0) {
      const date = extractDate({}, record);
      if (weekSet.has(date)) {
        map.get(date)!.push({
          recordId: record.id,
          recordSummary: record.summary,
          recordMemo: record.memo,
          uploadedAt: record.uploadedAt,
          date,
          programTitle,
        });
      }
    } else {
      for (const entry of entries) {
        const date = extractDate(entry, record);
        if (weekSet.has(date)) {
          map.get(date)!.push({
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
  }

  return weekDays.map((date) => ({
    date,
    entries: (map.get(date) ?? []).sort(
      (a, b) => parseStartMinutes(a.time) - parseStartMinutes(b.time)
    ),
  }));
}

function hasAnyInWeek(records: ScheduleRecord[], weekDays: string[]): boolean {
  return buildDayGroups(records, weekDays).some((g) => g.entries.length > 0);
}

/**
 * 이번 주(월~일)에 일정이 있으면 그 주를 쓰고,
 * 없으면 가장 가까운 일정이 있는 주(오늘 이후 날짜 우선)를 표시.
 */
function pickDisplayWeekMonday(
  records: ScheduleRecord[],
  todaySeoul: string
): { monday: string; isAlternateWeek: boolean } {
  const mondayThis = mondayOfWeekContaining(todaySeoul);
  const thisWeekDays = sevenDaysFromMonday(mondayThis);
  if (hasAnyInWeek(records, thisWeekDays)) {
    return { monday: mondayThis, isAlternateWeek: false };
  }

  const allDates = collectEntryDates(records);
  if (allDates.length === 0) {
    return { monday: mondayThis, isAlternateWeek: false };
  }

  const futureOrToday = allDates.find((d) => d >= todaySeoul);
  const anchor = futureOrToday ?? allDates[allDates.length - 1];
  const mondayAlt = mondayOfWeekContaining(anchor);
  return {
    monday: mondayAlt,
    isAlternateWeek: mondayAlt !== mondayThis,
  };
}

function EntryCard({
  entry,
  thisWeekMonday,
}: {
  entry: EntryWithMeta;
  thisWeekMonday: string;
}) {
  const [open, setOpen] = useState(false);

  const headline =
    entry.programTitle ?? entry.note ?? entry.recordSummary;

  const entryDate = entry.date?.slice(0, 10) ?? "";
  const entryWeekMonday = entryDate
    ? mondayOfWeekContaining(entryDate)
    : thisWeekMonday;
  const isThisWeek = entryWeekMonday === thisWeekMonday;

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
              isThisWeek ? "text-red-600" : "text-gray-800"
            }`}
          >
            {headline}
          </p>
          <DeleteRecordButton recordId={entry.recordId} className="shrink-0" />
        </div>
        {entry.time && (
          <p className="text-xs text-blue-600 font-medium mt-1">{entry.time}</p>
        )}
        {entry.person && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{entry.person}</p>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-purple-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-1.5">
          {entry.programTitle && (
            <p
              className={`font-semibold text-sm ${
                isThisWeek ? "text-red-600" : "text-gray-900"
              }`}
            >
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

export default function RecordingWeekView({
  records,
}: {
  records: ScheduleRecord[];
}) {
  const todayStr = getTodaySeoul();
  const { monday, isAlternateWeek } = pickDisplayWeekMonday(records, todayStr);
  const weekDays = sevenDaysFromMonday(monday);
  const dayGroups = buildDayGroups(records, weekDays);

  const hasAny = dayGroups.some((g) => g.entries.length > 0);

  /** 이번 주(오늘이 속한 월~일)의 월요일 — 제목 색상 구분용 */
  const thisWeekMonday = mondayOfWeekContaining(todayStr);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {isAlternateWeek ? "일정이 있는 주" : "이번 주 일정"}
        </h3>
        <span className="text-xs text-gray-400">
          {weekDays[0]} ~ {weekDays[6]}
        </span>
      </div>

      {hasAny && (
        <p className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            빨간 제목 = 이번 주(월~일) 방송일
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-700" />
            검은 제목 = 다음 주 등 다른 주
          </span>
        </p>
      )}

      {isAlternateWeek && hasAny && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          이번 주(월~일)에 등록된 일정이 없어, 가장 가까운 일정이 포함된 주를
          표시했습니다.
        </p>
      )}

      {!hasAny ? (
        <div className="text-center py-16 text-gray-400">
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
          <p className="text-sm">표시할 녹화일정이 없습니다.</p>
          <p className="text-xs mt-1">
            <a href="/submit" className="text-blue-500 hover:underline">
              일정 업로드
            </a>
            에서 이미지를 업로드해보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-0 pb-1">
          {dayGroups.map((group, idx) => {
            const isToday = group.date === todayStr;
            const [, mo, da] = group.date.split("-").map(Number);
            const dayLabel = DAY_LABELS[idx];
            const isWeekend = idx >= 5;

            return (
              <div
                key={group.date}
                className={`min-w-[110px] rounded-xl border p-2 flex flex-col gap-2 ${
                  isToday
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
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

                {group.entries.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-3">
                    일정 없음
                  </p>
                ) : (
                  group.entries.map((entry, i) => (
                    <EntryCard
                      key={`${entry.recordId}-${i}`}
                      entry={entry}
                      thisWeekMonday={thisWeekMonday}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
