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
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-blue-900 mb-2 tracking-tight">사무실일정 · 이번 주</h3>
            <RecordingWeekView
              records={officeRecords}
              sections="this-week"
              showLegend={false}
              embedded
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-indigo-900 mb-2 tracking-tight">제작일정 · 이번 주</h3>
            <RecordingWeekView
              records={productionRecords}
              sections="this-week"
              showLegend={false}
              embedded
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-800 mb-2 tracking-tight">사무실일정 · 이번 주 외</h3>
            <RecordingWeekView
              records={officeRecords}
              sections="other-week"
              showLegend={false}
              embedded
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-800 mb-2 tracking-tight">제작일정 · 이번 주 외</h3>
            <RecordingWeekView
              records={productionRecords}
              sections="other-week"
              showLegend={false}
              embedded
            />
          </div>
        </div>
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
