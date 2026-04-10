import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, analyzeWorkScheduleFromText } from "@/lib/ai";
import {
  validateAiResult,
  validateImageFile,
  validateDocumentType,
  validateWorkScheduleUploadFile,
  getWorkScheduleFileCategory,
  parseWorkScheduleKind,
  ValidationError,
} from "@/lib/validate";
import {
  normalizeRecord,
  DATA_FILE_MAP,
  getCommitMessage,
  buildMemoOnlyAiResult,
  ensureWorkScheduleKindInDetails,
} from "@/lib/normalize";
import { appendRecordToGitHub } from "@/lib/github";
import { SubmitApiResponse } from "@/lib/types";
import { extractTextFromDocxBuffer, extractTextFromPdfBuffer } from "@/lib/document-text";
import type { WorkScheduleKind } from "@/lib/types";

const MEMO_ONLY_MIN = 1;
const MEMO_ONLY_MAX = 8000;

/** PDF/AI 처리 시간 여유 (Vercel 등) */
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse<SubmitApiResponse>> {
  try {
    const formData = await request.formData();

    const imageFile = formData.get("image") as File | null;
    const documentTypeRaw = formData.get("documentType") as string | null;
    const memo = (formData.get("memo") as string | null) ?? "";
    const workScheduleKind: WorkScheduleKind = parseWorkScheduleKind(
      formData.get("workScheduleKind") as string | null
    );

    if (!documentTypeRaw) {
      return NextResponse.json(
        { success: false, error: "문서 종류를 선택해주세요." },
        { status: 400 }
      );
    }

    const documentType = validateDocumentType(documentTypeRaw);
    const hasImage = imageFile && imageFile.size > 0;

    let aiResult;

    if (!hasImage) {
      const trimmed = memo.trim();
      if (trimmed.length < MEMO_ONLY_MIN) {
        return NextResponse.json(
          {
            success: false,
            error: "이미지를 선택하거나 메모를 입력해 주세요.",
          },
          { status: 400 }
        );
      }
      if (trimmed.length > MEMO_ONLY_MAX) {
        return NextResponse.json(
          { success: false, error: `메모는 ${MEMO_ONLY_MAX}자 이하로 입력해 주세요.` },
          { status: 400 }
        );
      }
      aiResult = validateAiResult(
        buildMemoOnlyAiResult(trimmed, documentType, workScheduleKind),
        documentType
      );
    } else if (documentType === "work-schedule") {
      validateWorkScheduleUploadFile(imageFile);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const category = getWorkScheduleFileCategory(imageFile);

      if (category === "image") {
        const imageBase64 = buffer.toString("base64");
        const mimeType = imageFile.type || "image/jpeg";
        const raw = await analyzeImage(imageBase64, mimeType, "work-schedule", {
          workScheduleKind,
        });
        aiResult = validateAiResult(raw, documentType);
      } else if (category === "pdf") {
        const text = await extractTextFromPdfBuffer(buffer);
        const raw = await analyzeWorkScheduleFromText(text, workScheduleKind);
        aiResult = validateAiResult(raw, documentType);
      } else {
        const text = await extractTextFromDocxBuffer(buffer);
        const raw = await analyzeWorkScheduleFromText(text, workScheduleKind);
        aiResult = validateAiResult(raw, documentType);
      }
      ensureWorkScheduleKindInDetails(aiResult, workScheduleKind);
    } else {
      validateImageFile(imageFile);
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const imageBase64 = buffer.toString("base64");
      const mimeType = imageFile.type;

      const aiRawResult = await analyzeImage(imageBase64, mimeType, documentType);
      aiResult = validateAiResult(aiRawResult, documentType);
    }

    const today = new Date().toISOString().split("T")[0];
    const record = normalizeRecord(aiResult, documentType, memo);
    const filePath = DATA_FILE_MAP[documentType];
    const commitMessage = getCommitMessage(documentType, today);

    await appendRecordToGitHub(filePath, record, commitMessage);

    return NextResponse.json({
      success: true,
      id: record.id,
      summary: record.summary,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("Submit API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}
