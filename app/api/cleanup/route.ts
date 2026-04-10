import { NextResponse } from "next/server";
import { readRecordsFromGitHub, appendRecordToGitHub } from "@/lib/github";
import { ScheduleRecord } from "@/lib/types";

/** Asia/Seoul 기준 이번 주 월요일 00:00:00 UTC를 반환 */
function getThisWeekMondaySeoul(): Date {
  const todayStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const today = new Date(todayStr + "T00:00:00+09:00");
  const dow = today.getDay(); // 0=일 1=월 ... 6=토
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  return monday;
}

/** 녹화일정 records 중 이번 주 이전 항목을 제거한 배열 반환 */
function filterCurrentWeekRecordings(
  records: ScheduleRecord[]
): ScheduleRecord[] {
  const monday = getThisWeekMondaySeoul();

  return records.filter((record) => {
    const details = record.details as {
      entries?: { date?: string }[];
      period?: string;
    };

    // entries 중 하나라도 이번 주 날짜가 있으면 유지
    if (Array.isArray(details.entries) && details.entries.length > 0) {
      return details.entries.some((e) => {
        if (!e.date) return false;
        const d = new Date(e.date.slice(0, 10) + "T00:00:00+09:00");
        return d >= monday;
      });
    }

    // entries가 없으면 period 첫 날짜 기준
    if (details.period) {
      const match = details.period.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        const d = new Date(match[0] + "T00:00:00+09:00");
        return d >= monday;
      }
    }

    // 날짜 정보가 없으면 uploadedAt 기준
    const uploaded = new Date(record.uploadedAt);
    return uploaded >= monday;
  });
}

export async function POST(): Promise<NextResponse> {
  try {
    const filePath = "data/recordings.json";
    const allRecords = await readRecordsFromGitHub(filePath);

    const before = allRecords.length;
    const filtered = filterCurrentWeekRecordings(allRecords);
    const removed = before - filtered.length;

    if (removed === 0) {
      return NextResponse.json({ success: true, removed: 0, message: "삭제할 항목 없음" });
    }

    // GitHub에 덮어쓰기: appendRecordToGitHub 대신 직접 PUT
    // 기존 함수를 재활용하기 위해 filtered 배열 전체를 새 파일로 올림
    // (빈 배열로 초기화 후 filtered를 역순으로 추가하는 대신, github.ts에 overwrite 함수 추가)
    const { overwriteFileOnGitHub } = await import("@/lib/github");
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
    await overwriteFileOnGitHub(
      filePath,
      filtered,
      `[자동] 이전 주 녹화일정 정리 - ${today}`
    );

    return NextResponse.json({ success: true, removed, remaining: filtered.length });
  } catch (error) {
    console.error("Cleanup API 오류:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
