import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/ai";
import { validateAiResult, validateImageFile, validateDocumentType, ValidationError } from "@/lib/validate";
import { normalizeRecord, DATA_FILE_MAP, getCommitMessage } from "@/lib/normalize";
import { appendRecordToGitHub } from "@/lib/github";
import { SubmitApiResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<SubmitApiResponse>> {
  try {
    const formData = await request.formData();

    const imageFile = formData.get("image") as File | null;
    const documentTypeRaw = formData.get("documentType") as string | null;
    const memo = (formData.get("memo") as string | null) ?? "";

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: "이미지 파일이 없습니다." },
        { status: 400 }
      );
    }

    if (!documentTypeRaw) {
      return NextResponse.json(
        { success: false, error: "문서 종류를 선택해주세요." },
        { status: 400 }
      );
    }

    validateImageFile(imageFile);
    const documentType = validateDocumentType(documentTypeRaw);

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");
    const mimeType = imageFile.type;

    const aiRawResult = await analyzeImage(imageBase64, mimeType, documentType);
    const aiResult = validateAiResult(aiRawResult, documentType);

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
        error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}
