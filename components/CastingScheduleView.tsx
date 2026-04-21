"use client";

import { useState } from "react";
import { ScheduleRecord, CastingScheduleDetails, CastingEntry } from "@/lib/types";
import DeleteRecordButton from "./DeleteRecordButton";

function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = dateStr.slice(0, 10);
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[1]}/${parts[2]}`;
}

function VacationTable({ entries }: { entries: CastingEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">
        추출된 휴가/대근 정보가 없습니다.
      </p>
    );
  }

  const todayStr = getTodaySeoul();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-orange-50 border-b border-orange-200">
            <th className="text-left px-3 py-2 font-semibold text-orange-800 whitespace-nowrap">휴가자</th>
            <th className="text-left px-3 py-2 font-semibold text-orange-800 whitespace-nowrap">휴가일</th>
            <th className="text-left px-3 py-2 font-semibold text-orange-800 whitespace-nowrap">대근자(주간)</th>
            <th className="text-left px-3 py-2 font-semibold text-orange-800 whitespace-nowrap">대근자(야간)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isToday = entry.date?.slice(0, 10) === todayStr;
            return (
              <tr
                key={i}
                className={`border-b border-gray-100 ${isToday ? "bg-orange-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
              >
                <td className={`px-3 py-2 font-medium ${isToday ? "text-orange-700" : "text-gray-800"}`}>
                  {entry.person ?? "-"}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap ${isToday ? "text-orange-600 font-semibold" : "text-gray-600"}`}>
                  {formatDate(entry.date)}
                  {isToday && <span className="ml-1 text-orange-500 text-[10px]">오늘</span>}
                </td>
                <td className="px-3 py-2 text-blue-700">{entry.dayReplacer ?? "-"}</td>
                <td className="px-3 py-2 text-indigo-700">{entry.nightReplacer ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CastingRecordCard({ record }: { record: ScheduleRecord }) {
  const [showTable, setShowTable] = useState(false);
  const details = record.details as CastingScheduleDetails;
  const entries = Array.isArray(details.entries) ? details.entries : [];

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 bg-orange-50">
        <div className="flex-1 min-w-0">
          {details.period && (
            <p className="text-xs text-orange-600 mt-0.5">{details.period}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            업로드: {record.uploadedAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
          >
            {showTable ? "이미지 보기" : "휴가 테이블"}
          </button>
          <DeleteRecordButton recordId={record.id} />
        </div>
      </div>

      {/* 이미지 or 테이블 */}
      {showTable ? (
        <div className="p-3">
          <VacationTable entries={entries} />
        </div>
      ) : details.imageUrl || details.imageDataUrl || details.hasImage ? (
        <div className="p-3 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              details.imageUrl ??
              details.imageDataUrl ??
              `/api/records/${encodeURIComponent(record.id)}/image`
            }
            alt="주조 근무표"
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl object-contain"
          />
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-gray-400">
          저장된 이미지가 없습니다.
        </div>
      )}
    </div>
  );
}

export default function CastingScheduleView({ records }: { records: ScheduleRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">등록된 주조 근무표가 없습니다.</p>
        <p className="text-xs mt-1">
          <a href="/submit" className="text-blue-500 hover:underline">
            일정 업로드
          </a>
          에서 주조 근무표를 등록해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <CastingRecordCard key={record.id} record={record} />
      ))}
    </div>
  );
}
