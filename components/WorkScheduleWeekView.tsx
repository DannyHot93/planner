"use client";

import { useState } from "react";
import {
  ScheduleRecord,
  ScheduleEntry,
  WorkScheduleDetails,
} from "@/lib/types";
import {
  mondayOfWeekContaining,
  sevenDaysFromMonday,
} from "@/lib/seoul-week";
import DeleteRecordButton from "./DeleteRecordButton";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

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
}

interface DayGroup {
  date: string;
  entries: EntryWithMeta[];
}

function getScheduleKind(r: ScheduleRecord): "office" | "production" | "unknown" {
  const k = (r.details as WorkScheduleDetails).scheduleKind;
  if (k === "production") return "production";
  if (k === "office") return "office";
  return "unknown";
}

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
    const details = record.details as { entries?: ScheduleEntry[] };
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
  showShift,
}: {
  entry: EntryWithMeta;
  thisWeekMonday: string;
  showShift: boolean;
}) {
  const [open, setOpen] = useState(false);

  const headline = entry.person ?? entry.note ?? entry.recordSummary;
  const entryDate = entry.date?.slice(0, 10) ?? "";
  const entryWeekMonday = entryDate
    ? mondayOfWeekContaining(entryDate)
    : thisWeekMonday;
  const isThisWeek = entryWeekMonday === thisWeekMonday;

  const shiftLabel =
    entry.shift === "D"
      ? "오전근무"
      : entry.shift === "N"
        ? "오후근무"
        : null;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-default hover:border-blue-300 hover:shadow-md transition-all">
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
        {showShift && shiftLabel && (
          <p className="text-[11px] font-bold text-red-600 mt-0.5">{shiftLabel}</p>
        )}
        {entry.time && (
          <p className="text-xs text-blue-600 font-medium mt-1">{entry.time}</p>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-blue-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-1.5">
          <p className="text-gray-600">{entry.recordSummary}</p>
          {showShift && shiftLabel && (
            <p>
              <span className="text-gray-400">구분</span>{" "}
              <span className="text-red-600 font-semibold">{shiftLabel} (D/N)</span>
            </p>
          )}
          {entry.time && (
            <p>
              <span className="text-gray-400">시간</span>{" "}
              <span className="text-blue-600 font-medium">{entry.time}</span>
            </p>
          )}
          {entry.person && (
            <p>
              <span className="text-gray-400">이름</span> {entry.person}
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

type SubTab = "office" | "production";

export default function WorkScheduleWeekView({
  records,
}: {
  records: ScheduleRecord[];
}) {
  const [subTab, setSubTab] = useState<SubTab>("office");

  const officeRecords = records.filter((r) => {
    const k = getScheduleKind(r);
    return k === "office" || k === "unknown";
  });
  const productionRecords = records.filter((r) => getScheduleKind(r) === "production");

  const activeList = subTab === "office" ? officeRecords : productionRecords;
  const todayStr = getTodaySeoul();
  const { monday, isAlternateWeek } = pickDisplayWeekMonday(activeList, todayStr);
  const weekDays = sevenDaysFromMonday(monday);
  const dayGroups = buildDayGroups(activeList, weekDays);
  const hasAny = dayGroups.some((g) => g.entries.length > 0);
  const thisWeekMonday = mondayOfWeekContaining(todayStr);
  const showShift = subTab === "production";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setSubTab("office")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            subTab === "office"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          사무실 근무표
        </button>
        <button
          type="button"
          onClick={() => setSubTab("production")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            subTab === "production"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          제작 근무표
        </button>
      </div>

      {subTab === "production" && (
        <p className="text-xs text-gray-500 mb-3">
          제작 근무표 문서의 <span className="font-semibold text-red-600">D</span>는
          오전근무, <span className="font-semibold text-red-600">N</span>은 오후근무로
          표시합니다.
        </p>
      )}

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
            빨간 이름 = 이번 주(월~일) 근무일
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-700" />
            검은 이름 = 다른 주
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
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">
            {subTab === "office"
              ? "사무실 근무표가 없습니다."
              : "제작 근무표가 없습니다."}
          </p>
          <p className="text-xs mt-1">
            <a href="/submit" className="text-blue-500 hover:underline">
              일정 업로드
            </a>
            에서 근무표를 등록해 주세요.
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
                      showShift={showShift}
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
