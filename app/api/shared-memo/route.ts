import { NextRequest, NextResponse } from "next/server";
import {
  readSharedMemo,
  SHARED_MEMO_MAX_LENGTH,
  writeSharedMemo,
} from "@/lib/shared-memo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json(await readSharedMemo(), {
      headers: {
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("GET /api/shared-memo:", e);
    return NextResponse.json(
      { error: "메모를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { memo?: unknown };
    const memo = typeof body.memo === "string" ? body.memo : "";

    if (memo.length > SHARED_MEMO_MAX_LENGTH) {
      return NextResponse.json(
        { error: `메모는 ${SHARED_MEMO_MAX_LENGTH}자 이하로 입력해 주세요.` },
        { status: 400 }
      );
    }

    return NextResponse.json(await writeSharedMemo(memo));
  } catch (e) {
    console.error("PUT /api/shared-memo:", e);
    return NextResponse.json(
      { error: "메모를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
