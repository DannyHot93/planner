"use client";

import { useState } from "react";
import { ScheduleRecord } from "@/lib/types";
import HomeDashboardView from "./HomeDashboardView";
import RecordingWeekView from "./RecordingWeekView";
import WorkScheduleWeekView from "./WorkScheduleWeekView";
import VacationWeekView from "./VacationWeekView";

type TabValue =
  | "schedule"
  | "work-schedule"
  | "vacation"
  | "office-schedule"
  | "production-schedule";

const TABS: { value: TabValue; label: string }[] = [
  { value: "schedule", label: "일정" },
  { value: "work-schedule", label: "근무표" },
  { value: "vacation", label: "휴가" },
  { value: "office-schedule", label: "사무실일정" },
  { value: "production-schedule", label: "제작일정" },
];

const uploadButtonClass =
  "inline-flex shrink-0 items-center gap-2 px-4 py-2.5 sm:px-5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm";

export default function ScheduleListClient({
  records,
  castingRecords,
}: {
  records: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}) {
  const [activeTab, setActiveTab] = useState<TabValue>("schedule");

  const officeRecords = records.filter((r) => r.type === "office-schedule");
  const productionRecords = records.filter(
    (r) => r.type === "production-schedule" || (r.type as string) === "recording"
  );
  const workScheduleRecords = records.filter((r) => r.type === "work-schedule");
  const vacationRecords = records.filter((r) => r.type === "vacation");

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:shrink-0">
          일정 플래너
        </h1>

        <nav className="flex min-w-0 flex-1 justify-center" aria-label="일정 구역">
          <div
            role="tablist"
            className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-gray-100/95 p-1 shadow-inner ring-1 ring-gray-200/80 [scrollbar-width:thin]"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-3.5 sm:text-sm ${
                  activeTab === tab.value
                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <a href="/submit" className={uploadButtonClass}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          업로드
        </a>
      </header>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        {activeTab === "schedule" ? (
          <section className="space-y-4" aria-label="사무실·제작 일정과 휴가 요약">
            <HomeDashboardView
              officeRecords={officeRecords}
              productionRecords={productionRecords}
              vacationRecords={vacationRecords}
              castingRecords={castingRecords}
            />
          </section>
        ) : activeTab === "office-schedule" ? (
          <RecordingWeekView records={officeRecords} />
        ) : activeTab === "production-schedule" ? (
          <RecordingWeekView records={productionRecords} />
        ) : activeTab === "work-schedule" ? (
          <WorkScheduleWeekView records={workScheduleRecords} castingRecords={castingRecords} />
        ) : (
          <VacationWeekView vacationRecords={vacationRecords} castingRecords={castingRecords} />
        )}
      </div>
    </>
  );
}
