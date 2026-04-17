export type DocumentType = "work-schedule" | "vacation" | "recording" | "casting-schedule";

export interface ScheduleEntry {
  date?: string;
  time?: string;
  person?: string;
  note?: string;
  /** 녹화일정 등 */
  place?: string;
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
  /** 이미지로 업로드한 근무표 원본 (data URL) */
  imageDataUrl?: string;
  /** 미리보기 출처 (PDF는 1페이지만 렌더) */
  imagePreviewSource?: "uploaded-image" | "pdf-first-page";
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

/** 휴가 업로드 시 선택: 사무실 / 제작 (주조는 casting-schedules.json 별도) */
export type VacationKind = "office" | "production";

export interface VacationDetails {
  period?: string;
  person?: string;
  reason?: string;
  /** 업로드 시 선택. 없으면 UI에서는 사무실로 간주 */
  vacationKind?: VacationKind;
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

export interface RecordingDetails {
  period?: string;
  title?: string;
  /** 폼 직접 입력 시 프로그램명 (title과 동일 용도) */
  program?: string;
  entries?: ScheduleEntry[];
  [key: string]: unknown;
}

/** 주조 근무표 하단 휴가/대근 테이블의 개별 항목 */
export interface CastingEntry {
  /** 휴가자 이름 */
  person?: string;
  /** 휴가 날짜 (YYYY-MM-DD) */
  date?: string;
  /** 대근자(주간) */
  dayReplacer?: string;
  /** 대근자(야간) */
  nightReplacer?: string;
  note?: string;
  [key: string]: unknown;
}

export interface CastingScheduleDetails {
  period?: string;
  /** 업로드된 원본 이미지 (base64 data URL) */
  imageDataUrl?: string;
  /** AI가 추출한 휴가/대근 정보 */
  entries?: CastingEntry[];
  [key: string]: unknown;
}

export type DocumentDetails =
  | WorkScheduleDetails
  | VacationDetails
  | RecordingDetails
  | CastingScheduleDetails;

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
  /** 녹화일정: 방송일(또는 미입력 시 업로드일) 기준으로 이번 주 여부 */
  recordingWeek?: "this-week" | "other-week";
  /** 위 판단에 사용한 YYYY-MM-DD */
  recordingEffectiveDate?: string;
}
