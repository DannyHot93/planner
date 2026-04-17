import { NextResponse } from "next/server";
import { readRecordsFromGitHub, overwriteFileOnGitHub } from "@/lib/github";
import { filterRecordingsWeeklyCleanup, getTodaySeoulYmd } from "@/lib/recording-cleanup";

export async function POST(): Promise<NextResponse> {
  try {
    const filePath = "data/recordings.json";
    const allRecords = await readRecordsFromGitHub(filePath);

    const before = allRecords.length;
    const filtered = filterRecordingsWeeklyCleanup(allRecords);
    const removed = before - filtered.length;

    if (removed === 0) {
      return NextResponse.json({ success: true, removed: 0, message: "삭제할 항목 없음" });
    }

    await overwriteFileOnGitHub(
      filePath,
      filtered,
      `[자동] 직전 주 녹화일정 정리 - ${getTodaySeoulYmd()}`
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
