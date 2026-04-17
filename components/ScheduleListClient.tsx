"use client";

import { useState } from "react";
import { ScheduleRecord } from "@/lib/types";
import ScheduleList from "./ScheduleList";
import HomeDashboardView from "./HomeDashboardView";
import RecordingWeekView from "./RecordingWeekView";
import WorkScheduleWeekView from "./WorkScheduleWeekView";
import VacationWeekView from "./VacationWeekView";

type TabValue = "all" | "work-schedule" | "vacation" | "office-schedule" | "production-schedule";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "work-schedule", label: "근무표" },
  { value: "vacation", label: "휴가" },
  { value: "office-schedule", label: "사무실일정" },
  { value: "production-schedule", label: "제작일정" },
];

export default function ScheduleListClient({
  records,
  castingRecords,
}: {
  records: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const officeRecords = records.filter((r) => r.type === "office-schedule");
  /** 구 타입 `recording`(recordings.json)은 제작일정 탭과 동일하게 표시 */
  const productionRecords = records.filter(
    (r) => r.type === "production-schedule" || (r.type as string) === "recording"
  );
  const workScheduleRecords = records.filter((r) => r.type === "work-schedule");
  const vacationRecords = records.filter((r) => r.type === "vacation");

  return (
    <div className="space-y-10">
      <section aria-labelledby="dashboard-heading" className="space-y-4">
        <h2 id="dashboard-heading" className="text-base font-bold text-gray-900">
          이번 주 · 휴가 한눈에
        </h2>
        <HomeDashboardView
          officeRecords={officeRecords}
          productionRecords={productionRecords}
          vacationRecords={vacationRecords}
          castingRecords={castingRecords}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500">상세 탭</h2>
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all min-w-fit ${
                activeTab === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "office-schedule" ? (
          <RecordingWeekView records={officeRecords} />
        ) : activeTab === "production-schedule" ? (
          <RecordingWeekView records={productionRecords} />
        ) : activeTab === "work-schedule" ? (
          <WorkScheduleWeekView records={workScheduleRecords} castingRecords={castingRecords} />
        ) : activeTab === "vacation" ? (
          <VacationWeekView vacationRecords={vacationRecords} castingRecords={castingRecords} />
        ) : (
          <ScheduleList records={records} activeTab={activeTab} />
        )}
      </section>
    </div>
  );
}
