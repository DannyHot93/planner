import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getPlannerHomePayload } from "@/lib/planner-home-data";
import { PLANNER_RECORDS_CACHE_TAG } from "@/lib/planner-cache";

/** GitHub 읽기 캐시·unstable_cache와 맞춤 */
const CACHE_SECONDS = 1800;

const getCachedPlannerPayload = unstable_cache(
  async () => getPlannerHomePayload(),
  ["planner-home-payload-v1"],
  { tags: [PLANNER_RECORDS_CACHE_TAG], revalidate: CACHE_SECONDS }
);

/**
 * 홈 데이터 단일 엔드포인트. HTML/ISR와 분리해 새로고침 시 전 페이지 재생성 대신
 * 경량 JSON만 갱신한다. `revalidatePlannerHome()`으로 태그 무효화와 연동.
 */
export async function GET() {
  try {
    const data = await getCachedPlannerPayload();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("GET /api/planner-data:", e);
    return NextResponse.json(
      { error: "일정을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
