import { NextResponse } from "next/server";
import { getGoogleCalendarHealthSnapshot } from "@/lib/google-calendar-office";

export const runtime = "nodejs";

/**
 * Google Calendar 연동 진단 (비밀 미노출). 배포 URL에서 직접 열어 원인 확인.
 * 예: https://your-app.vercel.app/api/gcal-health
 */
export async function GET() {
  const body = await getGoogleCalendarHealthSnapshot();
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
