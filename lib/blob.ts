/**
 * Vercel Blob 업로드 헬퍼.
 *
 * - Vercel 프로젝트에 Blob 스토어를 연결하면 `BLOB_READ_WRITE_TOKEN`이
 *   자동으로 주입된다. 토큰이 없는 로컬/배포 환경에서는 null을 반환해
 *   호출부가 기존 data URL 저장 방식으로 fallback 하도록 한다.
 * - 파일 경로는 `records/{recordId}.{ext}` 형태로 고정해 같은 레코드를 수정해도
 *   같은 위치를 덮어쓴다(addRandomSuffix=false).
 */

import { put } from "@vercel/blob";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function extensionFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/bmp") return "bmp";
  return "bin";
}

/**
 * 레코드 이미지 버퍼를 Blob에 업로드하고 공개 URL을 반환.
 * 실패·토큰 미설정 시 null 반환 (호출부가 data URL fallback).
 */
export async function uploadRecordImageToBlob(
  recordId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  if (!isBlobConfigured()) return null;

  try {
    const ext = extensionFromMime(mimeType);
    const result = await put(`records/${recordId}.${ext}`, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    return result.url;
  } catch (error) {
    console.error("Vercel Blob 업로드 실패, data URL fallback:", error);
    return null;
  }
}
