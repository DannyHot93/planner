import { NextRequest, NextResponse } from "next/server";
import {
  appendRecordToGitHub,
  upsertRecordByExternalIdToGitHub,
} from "@/lib/github";
import {
  DATA_FILE_MAP,
  getCommitMessage,
  normalizeRecord,
} from "@/lib/normalize";
import { revalidatePlannerHome } from "@/lib/planner-cache";
import type { DocumentDetails } from "@/lib/types";
import { validateAiResult, validateDocumentType, ValidationError } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

type WebhookResponse = {
  success: boolean;
  id?: string;
  summary?: string;
  action?: "created" | "updated";
  external_id?: string;
  error?: string;
};

function jsonError(error: string, status: number): NextResponse<WebhookResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

function authenticate(request: NextRequest): NextResponse<WebhookResponse> | null {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return jsonError("WEBHOOK_SECRET이 설정되지 않았습니다.", 503);
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

function readStringField(
  body: Record<string, unknown>,
  field: string
): string | null {
  const value = body[field];
  return typeof value === "string" ? value.trim() : null;
}

function validateExternalId(externalId: string | null): string | null {
  if (!externalId) return null;
  if (externalId.length > 200) {
    throw new ValidationError("external_id는 200자 이하로 보내주세요.");
  }
  return externalId;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<WebhookResponse>> {
  const authError = authenticate(request);
  if (authError) return authError;

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("요청 본문은 JSON 객체여야 합니다.", 400);
    }

    const obj = body as Record<string, unknown>;
    const typeRaw = readStringField(obj, "type");
    if (!typeRaw) {
      return jsonError("type 필드가 필요합니다.", 400);
    }

    const summary = readStringField(obj, "summary");
    if (!summary) {
      return jsonError("summary 필드가 필요합니다.", 400);
    }

    const details = obj.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return jsonError("details 필드는 객체여야 합니다.", 400);
    }

    const documentType = validateDocumentType(typeRaw);
    const externalId = validateExternalId(readStringField(obj, "external_id"));
    const aiResult = validateAiResult(
      {
        summary,
        details: {
          ...(details as DocumentDetails),
          ...(externalId ? { external_id: externalId } : {}),
        },
      },
      documentType
    );
    const memo = readStringField(obj, "memo") ?? "";
    const record = normalizeRecord(aiResult, documentType, memo);

    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
    }).format(new Date());

    const filePath = DATA_FILE_MAP[documentType];
    const commitMessage = getCommitMessage(documentType, today);
    let saved: {
      action: "created" | "updated";
      record: typeof record;
    } = { action: "created", record };
    if (externalId) {
      saved = await upsertRecordByExternalIdToGitHub(
        filePath,
        externalId,
        record,
        commitMessage
      );
    } else {
      await appendRecordToGitHub(filePath, record, commitMessage);
    }
    revalidatePlannerHome();

    return NextResponse.json({
      success: true,
      id: saved.record.id,
      external_id: externalId ?? undefined,
      action: saved.action,
      summary: saved.record.summary,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("POST /api/webhook/records:", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Webhook 처리 중 오류가 발생했습니다.",
      500
    );
  }
}
