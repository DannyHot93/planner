"use client";

import { useState } from "react";
import { ScheduleRecord, DocumentType } from "@/lib/types";
import ScheduleList from "./ScheduleList";
import RecordingWeekView from "./RecordingWeekView";
import WorkScheduleWeekView from "./WorkScheduleWeekView";

type TabValue = DocumentType | "all";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "work-schedule", label: "근무표" },
  { value: "vacation", label: "휴가" },
  { value: "recording", label: "녹화일정" },
];

export default function ScheduleListClient({ records }: { records: ScheduleRecord[] }) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const recordingRecords = records.filter((r) => r.type === "recording");
  const workScheduleRecords = records.filter((r) => r.type === "work-schedule");

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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
        <WorkScheduleWeekView records={workScheduleRecords} />
      ) : (
        <ScheduleList records={records} activeTab={activeTab} />
      )}
    </div>
  );
}
