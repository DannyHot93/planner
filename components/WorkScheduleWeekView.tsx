"use client";

import { useState } from "react";
import { ScheduleRecord, WorkScheduleDetails } from "@/lib/types";
import DeleteRecordButton from "./DeleteRecordButton";
import CastingScheduleView from "./CastingScheduleView";

function getScheduleKind(r: ScheduleRecord): "office" | "production" | "unknown" {
  const k = (r.details as WorkScheduleDetails).scheduleKind;
  if (k === "production") return "production";
  if (k === "office") return "office";
  return "unknown";
}

type SubTab = "office" | "production" | "casting";

function WorkScheduleRecordBlock({ record }: { record: ScheduleRecord }) {
  const details = record.details as WorkScheduleDetails;
  const kind = getScheduleKind(record);
  const kindLabel =
    kind === "production" ? "제작" : kind === "office" ? "사무실" : "근무표";

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div
        className={`flex items-start justify-between px-4 py-3 border-b border-gray-100 ${
          kind === "production" ? "bg-indigo-50" : "bg-blue-50"
        }`}
      >
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
              kind === "production"
                ? "bg-indigo-200 text-indigo-900"
                : "bg-blue-200 text-blue-900"
            }`}
          >
            {kindLabel}
          </span>
          {details.period && (
            <p className="text-xs text-gray-600 mt-0.5">{details.period}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">업로드: {record.uploadedAt.slice(0, 10)}</p>
        </div>
        <DeleteRecordButton recordId={record.id} className="shrink-0 ml-2" />
      </div>

      {details.imageDataUrl ? (
        <div className="p-3 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={details.imageDataUrl}
            alt="근무표"
            className="w-full rounded-xl object-contain"
          />
          {details.imagePreviewSource === "pdf-first-page" && (
            <p className="text-[11px] text-gray-400 text-center mt-2">
              PDF 첫 페이지 미리보기 · 여러 페이지인 경우 나머지는 파일에서 확인하세요
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p className="text-xs text-gray-400">
            이미지 미리보기 없음(PDF·Word·메모 등으로 등록된 항목)
          </p>
          {record.memo && (
            <p className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-700">메모: {record.memo}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkScheduleWeekView({
  records,
  castingRecords = [],
}: {
  records: ScheduleRecord[];
  castingRecords?: ScheduleRecord[];
}) {
  const [subTab, setSubTab] = useState<SubTab>("office");

  const officeRecords = records.filter((r) => {
    const k = getScheduleKind(r);
    return k === "office" || k === "unknown";
  });
  const productionRecords = records.filter((r) => getScheduleKind(r) === "production");

  const SUB_TABS: { value: SubTab; label: string; activeColor: string }[] = [
    { value: "office", label: "사무실 근무표", activeColor: "bg-blue-600 text-white shadow-sm" },
    { value: "production", label: "제작 근무표", activeColor: "bg-indigo-600 text-white shadow-sm" },
    { value: "casting", label: "주조 근무표", activeColor: "bg-orange-500 text-white shadow-sm" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {SUB_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSubTab(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              subTab === t.value ? t.activeColor : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "casting" ? (
        <CastingScheduleView records={castingRecords} />
      ) : (() => {
        const activeList = subTab === "office" ? officeRecords : productionRecords;
        const emptyMsg = subTab === "office" ? "사무실 근무표가 없습니다." : "제작 근무표가 없습니다.";
        return activeList.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">{emptyMsg}</p>
            <p className="text-xs mt-1">
              <a href="/submit" className="text-blue-500 hover:underline">일정 업로드</a>에서 근무표를 등록해 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeList.map((record) => (
              <WorkScheduleRecordBlock key={record.id} record={record} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
