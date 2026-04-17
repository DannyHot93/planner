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
    <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 items-stretch">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {/* 사무실·제작 — 이번 주 묶음 */}
        <section
          aria-labelledby="dash-this-week-heading"
          className="rounded-2xl border-2 border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 p-4 sm:p-5 shadow-md shadow-blue-900/5 ring-1 ring-blue-100/80"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-200/70">
            <span
              className="inline-flex h-8 w-1 shrink-0 rounded-full bg-blue-500"
              aria-hidden
            />
            <div>
              <h2 id="dash-this-week-heading" className="text-sm font-bold text-blue-950 tracking-tight">
                이번 주 일정
              </h2>
              <p className="text-[11px] text-blue-700/80 mt-0.5">사무실일정 · 제작일정 (월~일 기준)</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
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
        </section>

        {/* 사무실·제작 — 이번 주 외 묶음 */}
        <section
          aria-labelledby="dash-other-week-heading"
          className="rounded-2xl border-2 border-slate-300/90 bg-gradient-to-br from-slate-100/90 via-white to-gray-50/60 p-4 sm:p-5 shadow-md shadow-slate-900/5 ring-1 ring-slate-200/90"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-300/70">
            <span
              className="inline-flex h-8 w-1 shrink-0 rounded-full bg-slate-500"
              aria-hidden
            />
            <div>
              <h2 id="dash-other-week-heading" className="text-sm font-bold text-slate-900 tracking-tight">
                이번 주 외 일정
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">사무실일정 · 제작일정</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
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
        </section>
      </div>

      <aside className="w-full xl:w-[min(100%,400px)] xl:shrink-0 xl:border-l xl:border-gray-100 xl:pl-6 xl:min-h-0">
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">휴가</h3>
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
