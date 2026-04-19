import { NextRequest, NextResponse } from "next/server";
import { readRecordsFromGitHub, overwriteFileOnGitHub } from "@/lib/github";
import { revalidatePlannerHome } from "@/lib/planner-cache";
import { filterRecordingsWeeklyCleanup, getTodaySeoulYmd } from "@/lib/recording-cleanup";
import { filterPastVacations } from "@/lib/vacation-cleanup";

const SCHEDULE_FILES: { path: string; label: string }[] = [
  { path: "data/office-schedules.json", label: "사무실일정" },
  { path: "data/production-schedules.json", label: "제작일정" },
  { path: "data/recordings.json", label: "녹화일정(레거시)" },
];

async function runCleanup(): Promise<NextResponse> {
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

    {
      const path = "data/vacations.json";
      const label = "휴가";
      const allRecords = await readRecordsFromGitHub(path);
      const before = allRecords.length;
      const filtered = filterPastVacations(allRecords, getTodaySeoulYmd());
      const removed = before - filtered.length;

      if (removed > 0) {
        await overwriteFileOnGitHub(
          path,
          filtered,
          `[자동] ${label} 지난 일정 정리 - ${getTodaySeoulYmd()}`
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

    revalidatePlannerHome();

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

/** 수동·외부 호출 */
export async function POST(): Promise<NextResponse> {
  return runCleanup();
}

/**
 * Vercel Cron 전용 (GET). 프로젝트에 `CRON_SECRET`을 두면 Authorization: Bearer … 로 검증합니다.
 * 매일 한국 자정 직후에 가깝게 돌리려면 UTC 15:05 → vercel.json schedule 참고.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET이 없으면 Cron을 사용할 수 없습니다." },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}
