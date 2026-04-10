export type DocumentType = "work-schedule" | "vacation" | "recording";

export interface ScheduleEntry {
  date?: string;
  time?: string;
  person?: string;
  note?: string;
  /** 제작 근무표: D=오전, N=오후 */
  shift?: "D" | "N";
  [key: string]: unknown;
}

/** 사무실 근무표 | 제작 근무표 (제작: 문서의 D/N 구분) */
export type WorkScheduleKind = "office" | "production";

export interface WorkScheduleDetails {
  period?: string;
  /** 업로드 시 선택한 근무표 종류 */
  scheduleKind?: WorkScheduleKind;
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

export interface VacationDetails {
  period?: string;
  person?: string;
  reason?: string;
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

export interface RecordingDetails {
  period?: string;
  title?: string;
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

export type DocumentDetails =
  | WorkScheduleDetails
  | VacationDetails
  | RecordingDetails;

export interface ScheduleRecord {
  id: string;
  type: DocumentType;
  uploadedAt: string;
  memo: string;
  summary: string;
  details: DocumentDetails;
}

export interface AiAnalysisResult {
  summary: string;
  details: DocumentDetails;
}

export interface SubmitApiResponse {
  success: boolean;
  id?: string;
  summary?: string;
  error?: string;
}
