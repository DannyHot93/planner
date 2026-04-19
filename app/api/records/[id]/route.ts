import { NextRequest, NextResponse } from "next/server";
import {
  deleteRecordByIdFromGitHub,
  updateRecordFieldsInGitHub,
} from "@/lib/github";
import { revalidatePlannerHome } from "@/lib/planner-cache";
import { getFilePathFromRecordId } from "@/lib/normalize";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const filePath = getFilePathFromRecordId(id);
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "알 수 없는 일정 ID입니다." },
        { status: 400 }
      );
    }

    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    const ok = await deleteRecordByIdFromGitHub(
      filePath,
      id,
      `[자동] 일정 삭제 - ${id.slice(0, 24)}… - ${today}`
    );

    if (!ok) {
      return NextResponse.json(
        { success: false, error: "해당 ID의 일정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    revalidatePlannerHome();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/records/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "삭제 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const filePath = getFilePathFromRecordId(id);
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "알 수 없는 일정 ID입니다." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const summary =
      "summary" in body && typeof (body as { summary?: unknown }).summary === "string"
        ? (body as { summary: string }).summary
        : undefined;
    const memo =
      "memo" in body && typeof (body as { memo?: unknown }).memo === "string"
        ? (body as { memo: string }).memo
        : undefined;
    const title =
      "title" in body && typeof (body as { title?: unknown }).title === "string"
        ? (body as { title: string }).title
        : undefined;
    const entryDateYmd =
      "entryDateYmd" in body &&
      typeof (body as { entryDateYmd?: unknown }).entryDateYmd === "string"
        ? (body as { entryDateYmd: string }).entryDateYmd
        : undefined;
    const entryTime =
      "entryTime" in body &&
      typeof (body as { entryTime?: unknown }).entryTime === "string"
        ? (body as { entryTime: string }).entryTime
        : undefined;

    const hasEntryTimePatch =
      entryDateYmd !== undefined &&
      entryDateYmd.trim() !== "" &&
      entryTime !== undefined;

    if (
      summary === undefined &&
      memo === undefined &&
      title === undefined &&
      !hasEntryTimePatch
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "summary, memo, title 중 하나 또는 entryDateYmd+entryTime을 보내 주세요.",
        },
        { status: 400 }
      );
    }

    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    const ok = await updateRecordFieldsInGitHub(
      filePath,
      id,
      {
        summary,
        memo,
        title,
        entryDateYmd: hasEntryTimePatch ? entryDateYmd.trim() : undefined,
        entryTime: hasEntryTimePatch ? entryTime : undefined,
      },
      `[자동] 일정 수정 - ${id.slice(0, 24)}… - ${today}`
    );

    if (!ok) {
      return NextResponse.json(
        { success: false, error: "해당 ID의 일정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    revalidatePlannerHome();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/records/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "수정 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
