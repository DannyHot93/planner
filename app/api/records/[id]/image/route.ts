import { NextResponse } from "next/server";
import { readRecordsFromGitHub } from "@/lib/github";
import { getFilePathFromRecordId } from "@/lib/normalize";
import type { ScheduleRecord } from "@/lib/types";

/**
 * 홈 초기 응답에서 제거한 `details.imageDataUrl`을 별도 경로로 지연 제공.
 * 브라우저 캐시를 공격적으로 붙여 재요청 시 오리진을 안 거치게 한다.
 */

function extractImageDataUrl(record: ScheduleRecord): string | null {
  const d = record.details as Record<string, unknown>;
  const url = d?.imageDataUrl;
  return typeof url === "string" && url.startsWith("data:") ? url : null;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  try {
    return { mime, buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const filePath = getFilePathFromRecordId(id);
    if (!filePath) {
      return NextResponse.json(
        { error: "알 수 없는 일정 ID입니다." },
        { status: 400 }
      );
    }

    const records = await readRecordsFromGitHub(filePath);
    const record = records.find((r) => r.id === id);
    if (!record) {
      return NextResponse.json(
        { error: "해당 ID의 일정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Vercel Blob 등 외부 스토리지에 올린 경우 그쪽으로 리다이렉트.
    const d = record.details as Record<string, unknown> | undefined;
    const externalUrl = d?.imageUrl;
    if (typeof externalUrl === "string" && /^https?:\/\//.test(externalUrl)) {
      return NextResponse.redirect(externalUrl, 308);
    }

    const dataUrl = extractImageDataUrl(record);
    if (!dataUrl) {
      return NextResponse.json(
        { error: "이 레코드에는 이미지가 없습니다." },
        { status: 404 }
      );
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "이미지 데이터가 올바르지 않습니다." },
        { status: 500 }
      );
    }

    const body = new Uint8Array(parsed.buffer);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": parsed.mime,
        "Content-Length": String(body.byteLength),
        /** 레코드 id가 바뀌면 URL도 달라지므로 강하게 캐시 */
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/records/[id]/image:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "이미지 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
