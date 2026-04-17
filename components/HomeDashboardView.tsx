"use client";

import { ScheduleRecord } from "@/lib/types";
import RecordingWeekView from "./RecordingWeekView";
import VacationWeekView from "./VacationWeekView";

export default function HomeDashboardView({
  officeRecords,
  productionRecords,
  vacationRecords,
  castingRecords,
}: {
  officeRecords: ScheduleRecord[];
  productionRecords: ScheduleRecord[];
  vacationRecords: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div className="min-w-0 flex-1 flex flex-col gap-6">
        {/* 사무실·제작 — 이번 주 묶음 */}
        <section
          aria-labelledby="dash-this-week-heading"
          className="rounded-2xl border-2 border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 p-4 sm:p-5 shadow-md shadow-blue-900/5 ring-1 ring-blue-100/80"
        >
          <div className="flex flex-row gap-4 sm:gap-5">
            <div className="flex shrink-0 flex-row items-stretch gap-2 border-r border-blue-200/70 pr-3 sm:pr-4">
              <span
                className="w-1 shrink-0 self-stretch min-h-[4.5rem] rounded-full bg-blue-500"
                aria-hidden
              />
              <h2
                id="dash-this-week-heading"
                className="writing-vertical-rl py-1 text-sm font-bold text-blue-950 tracking-tight [text-orientation:mixed]"
              >
                이번 주 일정
              </h2>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-blue-900 mb-2 tracking-tight">사무실일정</h3>
                <RecordingWeekView
                  records={officeRecords}
                  sections="this-week"
                  showLegend={false}
                  embedded
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-indigo-900 mb-2 tracking-tight">제작일정</h3>
                <RecordingWeekView
                  records={productionRecords}
                  sections="this-week"
                  showLegend={false}
                  embedded
                />
              </div>
            </div>
          </div>
        </section>

        {/* 사무실·제작 — 이번 주 외 묶음 */}
        <section
          aria-labelledby="dash-other-week-heading"
          className="rounded-2xl border-2 border-slate-300/90 bg-gradient-to-br from-slate-100/90 via-white to-gray-50/60 p-4 sm:p-5 shadow-md shadow-slate-900/5 ring-1 ring-slate-200/90"
        >
          <div className="flex flex-row gap-4 sm:gap-5">
            <div className="flex shrink-0 flex-row items-stretch gap-2 border-r border-slate-300/70 pr-3 sm:pr-4">
              <span
                className="w-1 shrink-0 self-stretch min-h-[5rem] rounded-full bg-slate-500"
                aria-hidden
              />
              <h2
                id="dash-other-week-heading"
                className="writing-vertical-rl py-1 text-sm font-bold text-slate-900 tracking-tight [text-orientation:mixed]"
              >
                이번 주 외 일정
              </h2>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 mb-2 tracking-tight">사무실일정</h3>
                <RecordingWeekView
                  records={officeRecords}
                  sections="other-week"
                  showLegend={false}
                  embedded
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 mb-2 tracking-tight">제작일정</h3>
                <RecordingWeekView
                  records={productionRecords}
                  sections="other-week"
                  showLegend={false}
                  embedded
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="w-full shrink-0 border-gray-100 lg:ml-auto lg:w-[min(100%,280px)] lg:shrink-0 lg:border-l lg:pl-6">
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">휴가</h3>
          <VacationWeekView
            vacationRecords={vacationRecords}
            castingRecords={castingRecords}
            variant="sidebar"
            hideTitle
          />
        </div>
      </aside>
    </div>
  );
}
