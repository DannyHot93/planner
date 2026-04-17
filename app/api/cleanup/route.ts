import { NextResponse } from "next/server";
import { readRecordsFromGitHub, overwriteFileOnGitHub } from "@/lib/github";
import { filterRecordingsWeeklyCleanup, getTodaySeoulYmd } from "@/lib/recording-cleanup";

const SCHEDULE_FILES: { path: string; label: string }[] = [
  { path: "data/office-schedules.json", label: "사무실일정" },
  { path: "data/production-schedules.json", label: "제작일정" },
  { path: "data/recordings.json", label: "녹화일정(레거시)" },
];

export async function POST(): Promise<NextResponse> {
  try {
    let totalRemoved = 0;
    const details: { path: string; removed: number; remaining: number }[] = [];

    for (const { path, label } of SCHEDULE_FILES) {
      const allRecords = await readRecordsFromGitHub(path);
      const before = allRecords.length;
      const filtered = filterRecordingsWeeklyCleanup(allRecords);
      const removed = before - filtered.length;

      if (removed > 0) {
        await overwriteFileOnGitHub(
          path,
          filtered,
          `[자동] 직전 주 ${label} 정리 - ${getTodaySeoulYmd()}`
        );
        totalRemoved += removed;
      }
      details.push({ path, removed, remaining: filtered.length });
    }

    if (totalRemoved === 0) {
      return NextResponse.json({
        success: true,
        removed: 0,
        message: "삭제할 항목 없음",
        details,
      });
    }

    return NextResponse.json({
      success: true,
      removed: totalRemoved,
      details,
    });
  } catch (error) {
    console.error("Cleanup API 오류:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
