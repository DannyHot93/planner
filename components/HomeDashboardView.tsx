"use client";

import { ScheduleRecord } from "@/lib/types";
import RecordingWeekView from "./RecordingWeekView";
import VacationWeekView from "./VacationWeekView";

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
}: {
  officeRecords: ScheduleRecord[];
  productionRecords: ScheduleRecord[];
  vacationRecords: ScheduleRecord[];
  editMode: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3">
        <div className="min-w-0 flex flex-1 flex-col gap-2">
          {/* 사무실·제작 — 이번 주 */}
          <section
            aria-labelledby="dash-this-week-heading"
            className="w-full rounded-2xl border-2 border-[#4361DE]/70 bg-gradient-to-br from-[#4361DE]/20 via-[#4361DE]/10 to-black p-2 sm:p-3 shadow-lg shadow-[#4361DE]/20 ring-1 ring-[#4361DE]/30"
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
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 사무실·제작 — 이번 주 외 */}
          <section
            aria-labelledby="dash-other-week-heading"
            className="w-full rounded-2xl border-2 border-[#CD366D]/70 bg-gradient-to-br from-[#CD366D]/20 via-[#CD366D]/10 to-black p-2 sm:p-3 shadow-lg shadow-[#CD366D]/20 ring-1 ring-[#CD366D]/30"
          >
            <h2 id="dash-other-week-heading" className="sr-only">
              이번 주 외 사무실·제작 일정
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
                    hideRecordActions
                    inlineEditMode={editMode}
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
                    hideRecordActions
                    inlineEditMode={editMode}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="w-full shrink-0 lg:ml-0 lg:w-[min(100%,168px)] lg:shrink-0 lg:border-l lg:border-white/10 lg:pl-3">
          <div className="lg:sticky lg:top-10 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
            <VacationWeekView
              vacationRecords={vacationRecords}
              variant="sidebar"
              hideTitle
              hideDeleteButtons
              inlineEditMode={editMode}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
