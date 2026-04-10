import { AiAnalysisResult, DocumentType } from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateAiResult(
  result: unknown,
  documentType: DocumentType
): AiAnalysisResult {
  if (!result || typeof result !== "object") {
    throw new ValidationError("AI 응답이 올바른 객체 형식이 아닙니다.");
  }

  const obj = result as Record<string, unknown>;

  if (typeof obj.summary !== "string" || obj.summary.trim() === "") {
    throw new ValidationError("AI 응답에 summary 필드가 없거나 비어있습니다.");
  }

  if (!obj.details || typeof obj.details !== "object") {
    throw new ValidationError("AI 응답에 details 필드가 없습니다.");
  }

  const details = obj.details as Record<string, unknown>;

  if (documentType === "work-schedule") {
    if (!Array.isArray(details.entries)) {
      details.entries = [];
    }
  } else if (documentType === "vacation") {
    if (!Array.isArray(details.entries)) {
      details.entries = [];
    }
  } else if (documentType === "recording") {
    if (!Array.isArray(details.entries)) {
      details.entries = [];
    }
  }

  return {
    summary: obj.summary.trim(),
    details: details,
  };
}

export function validateImageFile(file: File): void {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      "지원하지 않는 파일 형식입니다. JPEG, PNG, WEBP, GIF만 허용됩니다."
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new ValidationError("파일 크기가 10MB를 초과합니다.");
  }
}

export function validateDocumentType(type: string): DocumentType {
  const validTypes: DocumentType[] = ["work-schedule", "vacation", "recording"];
  if (!validTypes.includes(type as DocumentType)) {
    throw new ValidationError(
      `올바르지 않은 문서 종류입니다. (work-schedule, vacation, recording 중 하나)`
    );
  }
  return type as DocumentType;
}
