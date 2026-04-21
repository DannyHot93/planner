import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { getPlannerHomePayload } from "@/lib/planner-home-data";

export const runtime = "nodejs";
/** 대용량 JSON·GitHub blob 조합 시 10초 기본 한도를 넘지 않도록 */
export const maxDuration = 60;

/**
 * 홈 데이터 단일 엔드포인트. HTML/ISR와 분리해 새로고침 시 전 페이지 재생성 대신
 * 경량 JSON만 갱신한다. `revalidatePlannerHome()`으로 `lib/github` fetch 태그 무효화와 연동.
 *
 * 응답은 gzip으로 압축해 Vercel 응답 크기·전송 한도에 여유를 둔다.
 */
export async function GET() {
  try {
    const data = await getPlannerHomePayload();
    const json = JSON.stringify(data);
    const payload = gzipSync(Buffer.from(json, "utf8"));
    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
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
