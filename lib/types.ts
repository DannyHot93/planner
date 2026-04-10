export type DocumentType = "work-schedule" | "vacation" | "recording";

export interface ScheduleEntry {
  date?: string;
  time?: string;
  person?: string;
  note?: string;
  [key: string]: unknown;
}

export interface WorkScheduleDetails {
  period?: string;
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
