"use client";

import { useEffect, useMemo, useState } from "react";
import { ScheduleEntry, ScheduleRecord } from "@/lib/types";
import { toSeoulDateYmd } from "@/lib/seoul-week";
import RecordingWeekView from "./RecordingWeekView";
import VacationWeekView from "./VacationWeekView";

type DisplaySlide = "this-week" | "this-month" | "next-month";

const DISPLAY_SLIDE_MS: Record<DisplaySlide, number> = {
  "this-week": 30_000,
  "this-month": 10_000,
  "next-month": 10_000,
};

function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function addMonthsToMonthKey(ymd: string, offset: number): string {
  const [year, month] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function recordEntryDates(record: ScheduleRecord): string[] {
  const details = record.details as { entries?: ScheduleEntry[]; period?: string | null };
  const entries = Array.isArray(details.entries) ? details.entries : [];
  if (entries.length > 0) {
    return entries
      .map((entry) => (entry.date ? toSeoulDateYmd(entry.date) : ""))
      .filter(Boolean);
  }
  if (details.period) {
    const match = String(details.period).match(/\d{4}-\d{2}-\d{2}/);
    if (match) return [match[0]];
  }
  return [toSeoulDateYmd(record.uploadedAt) || record.uploadedAt.slice(0, 10)];
}

function hasRecordsInMonth(records: ScheduleRecord[], monthKey: string): boolean {
  return records.some((record) =>
    recordEntryDates(record).some((date) => date.startsWith(`${monthKey}-`))
  );
}

/** 한 글자씩 세로로 쌓아 라벨 폭을 최소화 */
function VerticalTypeLabel({
  label,
  accentClass,
  barClass,
}: {
  label: string;
  accentClass: string;
  barClass: string;
}) {
  const chars = [...label];
  return (
    <div className={`flex shrink-0 flex-row items-stretch gap-1 border-r pr-2 ${accentClass}`}>
      <span className="sr-only">{label}</span>
      <span className={`w-px shrink-0 self-stretch min-h-[2.5rem] rounded-full ${barClass}`} aria-hidden />
      <div className="flex flex-col items-center justify-center gap-0 py-0.5" aria-hidden>
        {chars.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="text-[11px] font-bold leading-[1.05] tracking-tight text-gray-100 sm:text-xs"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HomeDashboardView({
  officeRecords,
  productionRecords,
  vacationRecords,
  editMode,
  displayMode = false,
}: {
  officeRecords: ScheduleRecord[];
  productionRecords: ScheduleRecord[];
  vacationRecords: ScheduleRecord[];
  editMode: boolean;
  displayMode?: boolean;
}) {
  const [displaySlide, setDisplaySlide] = useState<DisplaySlide>("this-week");
  const displayMonthSlides = useMemo<DisplaySlide[]>(() => {
    if (!displayMode) return ["this-week", "this-month"];
    const today = getTodaySeoul();
    const nextMonthKey = addMonthsToMonthKey(today, 1);
    const scheduleRecords = [...officeRecords, ...productionRecords];
    return hasRecordsInMonth(scheduleRecords, nextMonthKey)
      ? ["this-week", "this-month", "next-month"]
      : ["this-week", "this-month"];
  }, [displayMode, officeRecords, productionRecords]);
  const showThisWeek = !displayMode || displaySlide === "this-week";
  const showSecondarySchedule =
    !displayMode || displaySlide === "this-month" || displaySlide === "next-month";
  const calendarMonthOffset = displaySlide === "next-month" ? 1 : 0;

  useEffect(() => {
    if (!displayMode) {
      setDisplaySlide("this-week");
      return;
    }

    if (!displayMonthSlides.includes(displaySlide)) {
      setDisplaySlide(displayMonthSlides[0]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDisplaySlide((current) => {
        const idx = displayMonthSlides.indexOf(current);
        return displayMonthSlides[(idx + 1) % displayMonthSlides.length];
      });
    }, DISPLAY_SLIDE_MS[displaySlide]);

    return () => window.clearTimeout(timeoutId);
  }, [displayMode, displayMonthSlides, displaySlide]);

  const rootClass = displayMode
    ? "flex flex-row items-stretch gap-2"
    : "flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3";
  const thisWeekSectionClass = displayMode
    ? "w-full rounded-lg border-2 border-[#4361DE]/70 bg-[#0b1020] p-2"
    : "w-full rounded-2xl border-2 border-[#4361DE]/70 bg-gradient-to-br from-[#4361DE]/20 via-[#4361DE]/10 to-black p-2 sm:p-3 shadow-lg shadow-[#4361DE]/20 ring-1 ring-[#4361DE]/30";
  const otherWeekSectionClass = displayMode
    ? "w-full rounded-lg border-2 border-[#CD366D]/70 bg-[#140b12] p-2"
    : "w-full rounded-2xl border-2 border-[#CD366D]/70 bg-gradient-to-br from-[#CD366D]/20 via-[#CD366D]/10 to-black p-2 sm:p-3 shadow-lg shadow-[#CD366D]/20 ring-1 ring-[#CD366D]/30";
  const asideClass = displayMode
    ? "w-[210px] shrink-0 border-l border-white/10 pl-2"
    : "w-full shrink-0 lg:ml-0 lg:w-[min(100%,168px)] lg:shrink-0 lg:border-l lg:border-white/10 lg:pl-3";
  const vacationWrapClass = displayMode
    ? ""
    : "lg:sticky lg:top-10 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1";

  return (
    <>
      <div className={rootClass}>
        <div className="min-w-0 flex flex-1 flex-col gap-2">
          {/* 사무실·제작 — 이번 주 */}
          {showThisWeek && (
            <section
              aria-labelledby="dash-this-week-heading"
              className={thisWeekSectionClass}
            >
              <h2 id="dash-this-week-heading" className="sr-only">
                이번 주 사무실·제작 일정
              </h2>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                  <VerticalTypeLabel
                    label="사무실일정"
                    accentClass="border-[#4361DE]/40"
                    barClass="bg-[#4361DE]"
                  />
                  <div className="min-w-0 flex-1">
                    <RecordingWeekView
                      records={officeRecords}
                      sections="this-week"
                      embedded
                      hideRecordActions
                      inlineEditMode={editMode}
                      displayMode={displayMode}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                  <VerticalTypeLabel
                    label="제작일정"
                    accentClass="border-[#4361DE]/30"
                    barClass="bg-[#6b82ea]"
                  />
                  <div className="min-w-0 flex-1">
                    <RecordingWeekView
                      records={productionRecords}
                      sections="this-week"
                      embedded
                      hideRecordActions
                      inlineEditMode={editMode}
                      displayMode={displayMode}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 일반 화면: 이번 주 외 전체 / display 화면: 월간 달력 로테이션 */}
          {showSecondarySchedule && (
            <section
              aria-labelledby="dash-other-week-heading"
              className={otherWeekSectionClass}
            >
              <h2 id="dash-other-week-heading" className="sr-only">
                월간 사무실·제작 일정
              </h2>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                  <VerticalTypeLabel
                    label="사무실일정"
                    accentClass="border-[#CD366D]/40"
                    barClass="bg-[#CD366D]"
                  />
                  <div className="min-w-0 flex-1">
                    <RecordingWeekView
                      records={officeRecords}
                      sections="other-week"
                      embedded
                      hideRecordActions={!editMode}
                      inlineEditMode={editMode}
                      displayMode={displayMode}
                      calendarMode
                      displayCalendarMonthOffset={calendarMonthOffset}
                      includeNextMonthCalendar={!displayMode}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                  <VerticalTypeLabel
                    label="제작일정"
                    accentClass="border-[#CD366D]/30"
                    barClass="bg-[#e05d8c]"
                  />
                  <div className="min-w-0 flex-1">
                    <RecordingWeekView
                      records={productionRecords}
                      sections="other-week"
                      embedded
                      hideRecordActions={!editMode}
                      inlineEditMode={editMode}
                      displayMode={displayMode}
                      calendarMode
                      displayCalendarMonthOffset={calendarMonthOffset}
                      includeNextMonthCalendar={!displayMode}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className={asideClass}>
          <div className={vacationWrapClass}>
            <VacationWeekView
              vacationRecords={vacationRecords}
              variant="sidebar"
              hideTitle
              hideDeleteButtons
              inlineEditMode={editMode}
              displayMode={displayMode}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
