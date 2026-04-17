import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  analyzeImage,
  analyzeWorkScheduleFromText,
  analyzeCastingScheduleImage,
} from "@/lib/ai";
import {
  validateAiResult,
  validateImageFile,
  validateDocumentType,
  validateWorkScheduleUploadFile,
  getWorkScheduleFileCategory,
  parseWorkScheduleKind,
  parseVacationKind,
  ValidationError,
  inferImageMimeType,
} from "@/lib/validate";
import {
  normalizeRecord,
  DATA_FILE_MAP,
  getCommitMessage,
  buildMemoOnlyAiResult,
  buildRecordingFormAiResult,
  buildVacationFormAiResult,
  mergeRecordingFormOverlay,
  mergeVacationFormOverlay,
  ensureWorkScheduleKindInDetails,
} from "@/lib/normalize";
import { appendRecordToGitHub } from "@/lib/github";
import { SubmitApiResponse } from "@/lib/types";
import type { WorkScheduleKind } from "@/lib/types";
import { toSeoulDateYmd } from "@/lib/seoul-week";
import {
  classifyRecordingWeekScope,
  getEffectiveRecordingYmd,
} from "@/lib/recording-week";
import { enrichRecordingScheduleAiResult } from "@/lib/recording-schedule-enrich";

const MEMO_ONLY_MIN = 1;
const MEMO_ONLY_MAX = 8000;

/** PDF/AI 처리 시간 여유 (Vercel 등) */
export const maxDuration = 60;

function parseRecordingForm(formData: FormData) {
  return {
    program: String(formData.get("recordingProgram") ?? "").trim(),
    dateYmd: String(formData.get("recordingDate") ?? "").trim(),
    time: String(formData.get("recordingTime") ?? "").trim(),
    place: String(formData.get("recordingPlace") ?? "").trim(),
    note: String(formData.get("recordingNote") ?? "").trim(),
  };
}

function parseVacationForm(formData: FormData) {
  return {
    person: String(formData.get("vacationPerson") ?? "").trim(),
    startYmd: String(formData.get("vacationDateStart") ?? "").trim(),
    endYmd: String(formData.get("vacationDateEnd") ?? "").trim(),
    note: String(formData.get("vacationNote") ?? "").trim(),
  };
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T12:00:00");
  return !Number.isNaN(t);
}

export async function POST(request: NextRequest): Promise<NextResponse<SubmitApiResponse>> {
  try {
    const formData = await request.formData();

    const imageFile = formData.get("image") as File | null;
    const documentTypeRaw = formData.get("documentType") as string | null;
    const memo = (formData.get("memo") as string | null) ?? "";
    const recordingForm = parseRecordingForm(formData);
    const vacationForm = parseVacationForm(formData);
    const workScheduleKind: WorkScheduleKind = parseWorkScheduleKind(
      formData.get("workScheduleKind") as string | null
    );
    const vacationKind = parseVacationKind(formData.get("vacationKind") as string | null);

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
      if (documentType === "office-schedule" || documentType === "production-schedule") {
        if (!recordingForm.program) {
          return NextResponse.json(
            { success: false, error: "프로그램 이름을 입력해 주세요." },
            { status: 400 }
          );
        }
        if (!recordingForm.dateYmd) {
          return NextResponse.json(
            { success: false, error: "날짜를 선택해 주세요." },
            { status: 400 }
          );
        }
        const ymd = toSeoulDateYmd(recordingForm.dateYmd) || recordingForm.dateYmd.slice(0, 10);
        if (!isValidYmd(ymd)) {
          return NextResponse.json(
            { success: false, error: "날짜 형식이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        const scheduleTypeNoImage =
          documentType === "office-schedule" ? "office" : "production";
        aiResult = validateAiResult(
          buildRecordingFormAiResult(
            recordingForm.program,
            ymd,
            recordingForm.time,
            recordingForm.place,
            recordingForm.note,
            scheduleTypeNoImage
          ),
          documentType
        );
      } else if (documentType === "vacation") {
        if (!vacationForm.person) {
          return NextResponse.json(
            { success: false, error: "휴가자 이름을 입력해 주세요." },
            { status: 400 }
          );
        }
        if (!vacationForm.startYmd) {
          return NextResponse.json(
            { success: false, error: "시작일을 선택해 주세요." },
            { status: 400 }
          );
        }
        const start =
          toSeoulDateYmd(vacationForm.startYmd) || vacationForm.startYmd.slice(0, 10);
        const endRaw = vacationForm.endYmd.trim()
          ? vacationForm.endYmd
          : vacationForm.startYmd;
        const end = toSeoulDateYmd(endRaw) || endRaw.slice(0, 10);
        if (!isValidYmd(start) || !isValidYmd(end)) {
          return NextResponse.json(
            { success: false, error: "날짜 형식이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        if (start > end) {
          return NextResponse.json(
            { success: false, error: "종료일은 시작일 이후여야 합니다." },
            { status: 400 }
          );
        }
        aiResult = validateAiResult(
          buildVacationFormAiResult(
            vacationForm.person,
            vacationKind,
            start,
            end,
            vacationForm.note
          ),
          documentType
        );
      } else {
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
          buildMemoOnlyAiResult(trimmed, documentType, workScheduleKind, vacationKind),
          documentType
        );
      }
    } else if (documentType === "casting-schedule") {
      validateImageFile(imageFile);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const mimeType = inferImageMimeType(imageFile);
      const { toOpenAiVisionInput } = await import("@/lib/image-for-openai");
      const { base64: visionBase64, mimeType: visionMime } =
        await toOpenAiVisionInput(buffer, mimeType);

      const castingRaw = await analyzeCastingScheduleImage(visionBase64, visionMime);

      const imageDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      aiResult = {
        summary: castingRaw.summary,
        details: {
          ...castingRaw.details,
          imageDataUrl,
          entries: castingRaw.details.entries ?? [],
        },
      };
    } else if (documentType === "work-schedule") {
      validateWorkScheduleUploadFile(imageFile);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const category = getWorkScheduleFileCategory(imageFile);

      if (category === "image") {
        const mimeType = inferImageMimeType(imageFile);
        const { toOpenAiVisionInput } = await import("@/lib/image-for-openai");
        const { base64: visionBase64, mimeType: visionMime } =
          await toOpenAiVisionInput(buffer, mimeType);
        const raw = await analyzeImage(visionBase64, visionMime, "work-schedule", {
          workScheduleKind,
        });
        aiResult = validateAiResult(raw, documentType);
        const imageDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
        const d = aiResult.details as Record<string, unknown>;
        d.imageDataUrl = imageDataUrl;
        d.imagePreviewSource = "uploaded-image";
      } else if (category === "pdf") {
        const { extractTextFromPdfBuffer, renderPdfFirstPageDataUrl } =
          await import("@/lib/document-text");
        const text = await extractTextFromPdfBuffer(buffer);
        const raw = await analyzeWorkScheduleFromText(text, workScheduleKind);
        aiResult = validateAiResult(raw, documentType);
        const previewUrl = await renderPdfFirstPageDataUrl(buffer);
        if (previewUrl) {
          const d = aiResult.details as Record<string, unknown>;
          d.imageDataUrl = previewUrl;
          d.imagePreviewSource = "pdf-first-page";
        }
      } else {
        const { extractTextFromDocxBuffer } = await import("@/lib/document-text");
        const text = await extractTextFromDocxBuffer(buffer);
        const raw = await analyzeWorkScheduleFromText(text, workScheduleKind);
        aiResult = validateAiResult(raw, documentType);
      }
      ensureWorkScheduleKindInDetails(aiResult, workScheduleKind);
    } else {
      validateImageFile(imageFile);
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = inferImageMimeType(imageFile);
      const { toOpenAiVisionInput } = await import("@/lib/image-for-openai");
      const { base64: visionBase64, mimeType: visionMime } =
        await toOpenAiVisionInput(buffer, mimeType);

      const aiRawResult = await analyzeImage(
        visionBase64,
        visionMime,
        documentType as Exclude<typeof documentType, "casting-schedule">
      );
      aiResult = validateAiResult(aiRawResult, documentType);
      if (documentType === "office-schedule" || documentType === "production-schedule") {
        aiResult = enrichRecordingScheduleAiResult(aiResult, documentType);
      }
      if (documentType === "vacation") {
        const d = aiResult.details as Record<string, unknown>;
        d.vacationKind = vacationKind;
        const merged = mergeVacationFormOverlay(
          aiResult,
          {
            person: vacationForm.person,
            startYmd: vacationForm.startYmd,
            endYmd: vacationForm.endYmd,
            note: vacationForm.note,
          },
          vacationKind
        );
        aiResult = validateAiResult(merged, documentType);
      }
      if (documentType === "office-schedule" || documentType === "production-schedule") {
        const merged = mergeRecordingFormOverlay(aiResult, recordingForm);
        aiResult = validateAiResult(merged, documentType);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const memoForRecord =
      documentType === "office-schedule" || documentType === "production-schedule"
        ? recordingForm.note ||
          (!hasImage && recordingForm.program
            ? `${recordingForm.program} · ${recordingForm.dateYmd}`
            : "")
        : documentType === "vacation"
          ? vacationForm.note ||
            (!hasImage && vacationForm.person
              ? `${vacationForm.person} · ${vacationForm.startYmd}${
                  vacationForm.endYmd.trim() &&
                  vacationForm.endYmd !== vacationForm.startYmd
                    ? ` ~ ${vacationForm.endYmd}`
                    : ""
                }`
              : "")
          : memo;
    const record = normalizeRecord(aiResult, documentType, memoForRecord);
    const filePath = DATA_FILE_MAP[documentType];
    const commitMessage = getCommitMessage(documentType, today);

    await appendRecordToGitHub(filePath, record, commitMessage);
    revalidatePath("/");

    const payload: SubmitApiResponse = {
      success: true,
      id: record.id,
      summary: record.summary,
    };
    if (documentType === "office-schedule" || documentType === "production-schedule") {
      const recordingEffectiveDate = getEffectiveRecordingYmd(record);
      payload.recordingEffectiveDate = recordingEffectiveDate;
      payload.recordingWeek = classifyRecordingWeekScope(recordingEffectiveDate);
    }

    return NextResponse.json(payload);
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
