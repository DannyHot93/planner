"use client";

import { useState } from "react";
import { ScheduleRecord, ScheduleEntry } from "@/lib/types";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** Asia/Seoul 기준 오늘 날짜를 YYYY-MM-DD로 반환 */
function getTodaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/** Asia/Seoul 기준 이번 주 월요일 ~ 일요일 날짜 배열 반환 */
function getThisWeekDays(): string[] {
  const todayStr = getTodaySeoul();
  const today = new Date(todayStr + "T00:00:00");
  const dow = today.getDay(); // 0=일 1=월 ... 6=토
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7)); // 월요일로 이동

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
      d
    );
  });
}

interface EntryWithMeta extends ScheduleEntry {
  recordId: string;
  recordSummary: string;
  recordMemo: string;
  uploadedAt: string;
}

interface DayGroup {
  date: string; // YYYY-MM-DD
  entries: EntryWithMeta[];
}

/** entries[].date가 없으면 period 첫 날짜를 파싱해서 사용 */
function extractDate(entry: ScheduleEntry, record: ScheduleRecord): string {
  if (entry.date) return entry.date.slice(0, 10);
  const details = record.details as { period?: string };
  if (details.period) {
    const match = details.period.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return record.uploadedAt.slice(0, 10);
}

/** 시간 문자열 "HH:MM" 또는 "HH:MM~HH:MM" 등에서 시작 시간 분 단위로 변환 */
function parseStartMinutes(time?: string): number {
  if (!time) return 0;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function buildDayGroups(
  records: ScheduleRecord[],
  weekDays: string[]
): DayGroup[] {
  const weekSet = new Set(weekDays);
  const map = new Map<string, EntryWithMeta[]>();
  weekDays.forEach((d) => map.set(d, []));

  for (const record of records) {
    const details = record.details as { entries?: ScheduleEntry[] };
    const entries = Array.isArray(details.entries) ? details.entries : [];

    if (entries.length === 0) {
      // entries가 없으면 record 자체를 하나의 항목으로 취급
      const date = extractDate({}, record);
      if (weekSet.has(date)) {
        map.get(date)!.push({
          recordId: record.id,
          recordSummary: record.summary,
          recordMemo: record.memo,
          uploadedAt: record.uploadedAt,
          date,
          time: undefined,
          person: undefined,
          note: undefined,
        });
      }
    } else {
      for (const entry of entries) {
        const date = extractDate(entry, record);
        if (weekSet.has(date)) {
          map.get(date)!.push({
            ...entry,
            date,
            recordId: record.id,
            recordSummary: record.summary,
            recordMemo: record.memo,
            uploadedAt: record.uploadedAt,
          });
        }
      }
    }
  }

  return weekDays.map((date) => ({
    date,
    entries: (map.get(date) ?? []).sort(
      (a, b) => parseStartMinutes(a.time) - parseStartMinutes(b.time)
    ),
  }));
}

function EntryCard({ entry }: { entry: EntryWithMeta }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* 카드 본체 */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-default hover:border-purple-300 hover:shadow-md transition-all">
        <p className="text-sm font-semibold text-gray-800 leading-snug">
          {entry.note ?? entry.recordSummary}
        </p>
        {entry.time && (
          <p className="text-xs text-purple-600 font-medium mt-1">{entry.time}</p>
        )}
        {entry.person && (
          <p className="text-xs text-gray-400 mt-0.5">{entry.person}</p>
        )}
      </div>

      {/* 호버 상세 팝업 */}
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-purple-200 rounded-xl shadow-xl p-4 text-xs text-gray-700 space-y-1.5">
          <p className="font-semibold text-gray-900 text-sm">{entry.recordSummary}</p>
          {entry.time && (
            <p>
              <span className="text-gray-400">시간</span>{" "}
              <span className="text-purple-600 font-medium">{entry.time}</span>
            </p>
          )}
          {entry.person && (
            <p>
              <span className="text-gray-400">담당</span> {entry.person}
            </p>
          )}
          {entry.note && (
            <p>
              <span className="text-gray-400">메모</span> {entry.note}
            </p>
          )}
          {entry.recordMemo && entry.recordMemo !== entry.note && (
            <p>
              <span className="text-gray-400">비고</span> {entry.recordMemo}
            </p>
          )}
          <p className="text-gray-300 pt-1 border-t border-gray-100">
            업로드: {entry.uploadedAt.slice(0, 10)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function RecordingWeekView({
  records,
}: {
  records: ScheduleRecord[];
}) {
  const weekDays = getThisWeekDays();
  const todayStr = getTodaySeoul();
  const dayGroups = buildDayGroups(records, weekDays);

  const hasAny = dayGroups.some((g) => g.entries.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">이번 주 일정</h3>
        <span className="text-xs text-gray-400">
          {weekDays[0]} ~ {weekDays[6]}
        </span>
      </div>

      {!hasAny ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <p className="text-sm">이번 주 녹화일정이 없습니다.</p>
          <p className="text-xs mt-1">
            <a href="/submit" className="text-blue-500 hover:underline">
              일정 업로드
            </a>
            에서 이미지를 업로드해보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-0">
          {dayGroups.map((group, idx) => {
            const isToday = group.date === todayStr;
            const [, mo, da] = group.date.split("-").map(Number);
            const dayLabel = DAY_LABELS[idx === 6 ? 0 : idx + 1]; // 월~일 순서

            return (
              <div
                key={group.date}
                className={`min-w-[110px] rounded-xl border p-2 flex flex-col gap-2 ${
                  isToday
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {/* 요일 헤더 */}
                <div className="flex items-center justify-between px-1">
                  <span
                    className={`text-xs font-bold ${
                      isToday ? "text-blue-600" : "text-gray-500"
                    }`}
                  >
                    {dayLabel}
                  </span>
                  <span
                    className={`text-xs ${
                      isToday ? "text-blue-500 font-semibold" : "text-gray-400"
                    }`}
                  >
                    {pad2(mo)}/{pad2(da)}
                  </span>
                </div>

                {/* 항목 목록 */}
                {group.entries.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-3">
                    일정 없음
                  </p>
                ) : (
                  group.entries.map((entry, i) => (
                    <EntryCard key={`${entry.recordId}-${i}`} entry={entry} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
