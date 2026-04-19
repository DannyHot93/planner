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
            className="text-[11px] font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-xs"
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
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="min-w-0 flex flex-1 flex-col gap-6">
          {/* 사무실·제작 — 이번 주 */}
          <section
            aria-labelledby="dash-this-week-heading"
            className="w-full rounded-2xl border-2 border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 p-4 sm:p-5 shadow-md shadow-blue-900/5 ring-1 ring-blue-100/80"
          >
            <h2 id="dash-this-week-heading" className="sr-only">
              이번 주 사무실·제작 일정
            </h2>
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                <VerticalTypeLabel
                  label="사무실일정"
                  accentClass="border-blue-200/70"
                  barClass="bg-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <RecordingWeekView
                    records={officeRecords}
                    sections="this-week"
                    showLegend={false}
                    embedded
                    hideRecordActions
                    inlineEditMode={editMode}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                <VerticalTypeLabel
                  label="제작일정"
                  accentClass="border-indigo-200/70"
                  barClass="bg-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <RecordingWeekView
                    records={productionRecords}
                    sections="this-week"
                    showLegend={false}
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
            className="w-full rounded-2xl border-2 border-slate-300/90 bg-gradient-to-br from-slate-100/90 via-white to-gray-50/60 p-4 sm:p-5 shadow-md shadow-slate-900/5 ring-1 ring-slate-200/90"
          >
            <h2 id="dash-other-week-heading" className="sr-only">
              이번 주 외 사무실·제작 일정
            </h2>
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                <VerticalTypeLabel
                  label="사무실일정"
                  accentClass="border-slate-300/70"
                  barClass="bg-slate-500"
                />
                <div className="min-w-0 flex-1">
                  <RecordingWeekView
                    records={officeRecords}
                    sections="other-week"
                    showLegend={false}
                    embedded
                    hideRecordActions
                    inlineEditMode={editMode}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-2.5">
                <VerticalTypeLabel
                  label="제작일정"
                  accentClass="border-slate-400/70"
                  barClass="bg-slate-600"
                />
                <div className="min-w-0 flex-1">
                  <RecordingWeekView
                    records={productionRecords}
                    sections="other-week"
                    showLegend={false}
                    embedded
                    hideRecordActions
                    inlineEditMode={editMode}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="w-full shrink-0 border-gray-100 lg:ml-0 lg:w-[min(100%,168px)] lg:shrink-0 lg:border-l lg:pl-5">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
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
