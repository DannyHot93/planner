import { NextResponse } from "next/server";
import { getPlannerHomePayload } from "@/lib/planner-home-data";

/**
 * 홈 데이터 단일 엔드포인트. HTML/ISR와 분리해 새로고침 시 전 페이지 재생성 대신
 * 경량 JSON만 갱신한다. `revalidatePlannerHome()`으로 `lib/github` fetch 태그 무효화와 연동.
 *
 * 참고: Route Handler에서는 `unstable_cache` 래핑이 런타임에서 실패할 수 있어
 * 사용하지 않는다. GitHub `readRecordsFromGitHub`의 `fetch(..., { next: { tags } })`만으로
 * 데이터 캐시가 동작한다.
 */
export async function GET() {
  try {
    const data = await getPlannerHomePayload();
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
