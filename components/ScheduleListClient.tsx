"use client";

import { useState } from "react";
import { ScheduleRecord, DocumentType } from "@/lib/types";
import ScheduleList from "./ScheduleList";
import RecordingWeekView from "./RecordingWeekView";
import WorkScheduleWeekView from "./WorkScheduleWeekView";
import VacationWeekView from "./VacationWeekView";

type TabValue = "all" | "work-schedule" | "vacation" | "recording";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "work-schedule", label: "근무표" },
  { value: "vacation", label: "휴가" },
  { value: "recording", label: "녹화일정" },
];

export default function ScheduleListClient({
  records,
  castingRecords,
}: {
  records: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const recordingRecords = records.filter((r) => r.type === "recording");
  const workScheduleRecords = records.filter((r) => r.type === "work-schedule");
  const vacationRecords = records.filter((r) => r.type === "vacation");

  return (
    <div>
      {/* 탭 */}
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

      {activeTab === "recording" ? (
        <RecordingWeekView records={recordingRecords} />
      ) : activeTab === "work-schedule" ? (
        <WorkScheduleWeekView records={workScheduleRecords} castingRecords={castingRecords} />
      ) : activeTab === "vacation" ? (
        <VacationWeekView vacationRecords={vacationRecords} castingRecords={castingRecords} />
      ) : (
        <ScheduleList records={records} activeTab={activeTab} />
      )}
    </div>
  );
}
