import { AiAnalysisResult, DocumentType, WorkScheduleKind } from "./types";

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

const WORK_SCHEDULE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** 근무표: 이미지·PDF·docx */
export function validateWorkScheduleUploadFile(file: File): void {
  const name = file.name.toLowerCase();
  const okMime = WORK_SCHEDULE_TYPES.includes(file.type);
  const okExt =
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    /\.(jpe?g|png|webp|gif)$/i.test(name);
  if (!okMime && !okExt) {
    throw new ValidationError(
      "근무표는 이미지(JPEG, PNG, WEBP, GIF), PDF, Word(.docx)만 업로드할 수 있습니다."
    );
  }
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ValidationError("파일 크기가 10MB를 초과합니다.");
  }
}

export function getWorkScheduleFileCategory(
  file: File
): "image" | "pdf" | "docx" {
  const t = file.type;
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(n)) {
    return "image";
  }
  if (t === "application/pdf" || n.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".docx")
  ) {
    return "docx";
  }
  throw new ValidationError(
    "근무표 파일 형식을 확인할 수 없습니다. 이미지, PDF, docx만 지원합니다."
  );
}

export function parseWorkScheduleKind(raw: string | null): WorkScheduleKind {
  if (raw === "production") return "production";
  return "office";
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
