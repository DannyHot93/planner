import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteRecordByIdFromGitHub } from "@/lib/github";
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

    revalidatePath("/");
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
