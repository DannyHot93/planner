"use client";

import { useMemo } from "react";
import { ScheduleEntry, ScheduleRecord } from "@/lib/types";
import {
  addDaysYmd,
  mondayOfWeekContaining,
  toSeoulDateYmd,
} from "@/lib/seoul-week";
import RecordingWeekView from "./RecordingWeekView";

export type ScheduleRange =
  | "this-week"
  | "two-weeks"
  | "one-month"
  | "after-month";

export const SCHEDULE_RANGE_OPTIONS: {
  value: ScheduleRange;
  label: string;
}[] = [
  { value: "this-week", label: "이번주일정" },
  { value: "two-weeks", label: "2주간 일정" },
  { value: "one-month", label: "이번달 일정" },
  { value: "after-month", label: "한달 이후 일정" },
];

function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getMonthBoundaries(ymd: string): {
  monthStart: string;
  monthEnd: string;
  nextMonthStart: string;
} {
  const [year, month] = ymd.split("-").map(Number);
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nextMonth = new Date(Date.UTC(year, month, 1));
  return {
    monthStart: `${year}-${pad2(month)}-01`,
    monthEnd: `${year}-${pad2(month)}-${pad2(monthEndDay)}`,
    nextMonthStart: `${nextMonth.getUTCFullYear()}-${pad2(
      nextMonth.getUTCMonth() + 1
    )}-01`,
  };
}

function formatRangeDate(ymd: string): string {
  const [, month, day] = ymd.split("-").map(Number);
  return `${month}.${day}`;
}

function entryDate(entry: ScheduleEntry): string {
  return toSeoulDateYmd(entry.date);
}

function fallbackRecordDate(record: ScheduleRecord): string {
  const period = (record.details as { period?: string | null }).period;
  const periodDate = period?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return (
    toSeoulDateYmd(periodDate) ||
    toSeoulDateYmd(record.uploadedAt) ||
    record.uploadedAt.slice(0, 10)
  );
}

function filterRecords(
  records: ScheduleRecord[],
  start: string,
  end?: string
): ScheduleRecord[] {
  const inRange = (date: string) => date >= start && (!end || date <= end);

  return records.flatMap((record) => {
    const details = record.details as { entries?: ScheduleEntry[] };
    const entries = Array.isArray(details.entries) ? details.entries : [];

    if (entries.length === 0) {
      return inRange(fallbackRecordDate(record)) ? [record] : [];
    }

    const matchingEntries = entries.filter((entry) => {
      const date = entryDate(entry) || fallbackRecordDate(record);
      return inRange(date);
    });

    if (matchingEntries.length === 0) return [];
    if (matchingEntries.length === entries.length) return [record];

    return [
      {
        ...record,
        details: {
          ...record.details,
          entries: matchingEntries,
        },
      },
    ];
  });
}

function monthOffsetFromToday(today: string, date: string): number {
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [year, month] = date.split("-").map(Number);
  return (year - todayYear) * 12 + month - todayMonth;
}

function recordDates(record: ScheduleRecord): string[] {
  const entries = (record.details as { entries?: ScheduleEntry[] }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return [fallbackRecordDate(record)];
  }
  return entries
    .map((entry) => entryDate(entry) || fallbackRecordDate(record))
    .filter(Boolean);
}

export default function ScheduleRangeMenu({
  records,
  scheduleLabel,
  activeRange,
  displayMode = false,
  editMode = false,
}: {
  records: ScheduleRecord[];
  scheduleLabel: string;
  activeRange: ScheduleRange;
  displayMode?: boolean;
  editMode?: boolean;
}) {
  const today = getTodaySeoul();
  const thisWeekMonday = mondayOfWeekContaining(today);
  const thisWeekSunday = addDaysYmd(thisWeekMonday, 6);
  const twoWeekSunday = addDaysYmd(thisWeekMonday, 13);
  const { monthStart, monthEnd, nextMonthStart } = getMonthBoundaries(today);

  const visibleRecords = useMemo(() => {
    switch (activeRange) {
      case "this-week":
        return filterRecords(records, thisWeekMonday, thisWeekSunday);
      case "two-weeks":
        return filterRecords(records, thisWeekMonday, twoWeekSunday);
      case "one-month":
        return filterRecords(records, monthStart, monthEnd);
      case "after-month":
        return filterRecords(records, nextMonthStart);
    }
  }, [
    activeRange,
    monthEnd,
    monthStart,
    nextMonthStart,
    records,
    thisWeekMonday,
    thisWeekSunday,
    twoWeekSunday,
  ]);

  const calendarMonthOffsets = useMemo(() => {
    if (activeRange === "one-month") {
      return [0];
    }
    if (activeRange !== "after-month") return undefined;
    return Array.from(
      new Set(
        visibleRecords
          .flatMap(recordDates)
          .map((date) => monthOffsetFromToday(today, date))
          .filter((offset) => offset >= 0)
      )
    ).sort((a, b) => a - b);
  }, [activeRange, today, visibleRecords]);

  const rangeDescription =
    activeRange === "this-week"
      ? `${formatRangeDate(thisWeekMonday)} ~ ${formatRangeDate(thisWeekSunday)}`
      : activeRange === "two-weeks"
        ? `${formatRangeDate(thisWeekMonday)} ~ ${formatRangeDate(twoWeekSunday)}`
        : activeRange === "one-month"
          ? `${formatRangeDate(monthStart)} ~ ${formatRangeDate(monthEnd)}`
          : `${formatRangeDate(nextMonthStart)} 이후`;

  return (
    <section aria-label={`${scheduleLabel} 기간별 보기`} className="space-y-2">
      <div
        id={`${scheduleLabel}-range-panel`}
        className="space-y-2"
      >
        <div className="flex justify-end px-1">
          <p className="text-xs font-medium text-gray-400">
            {rangeDescription} · {visibleRecords.length}건
          </p>
        </div>

        {activeRange === "this-week" ? (
          <RecordingWeekView
            records={visibleRecords}
            sections="this-week"
            hideRecordActions={!editMode}
            inlineEditMode={editMode}
            displayMode={displayMode}
          />
        ) : activeRange === "two-weeks" ? (
          <RecordingWeekView
            records={visibleRecords}
            sections="this-week"
            includeNextWeekSection
            hideRecordActions={!editMode}
            inlineEditMode={editMode}
            displayMode={displayMode}
          />
        ) : (
          <RecordingWeekView
            records={visibleRecords}
            sections="other-week"
            calendarMode
            bareCalendar
            calendarMonthOffsets={calendarMonthOffsets}
            hideRecordActions={!editMode}
            inlineEditMode={editMode}
            displayMode={displayMode}
          />
        )}
      </div>
    </section>
  );
}
