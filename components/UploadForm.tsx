"use client";

import { useState, useRef, ChangeEvent, FormEvent, useEffect } from "react";
import { DocumentType, SubmitApiResponse, VacationKind } from "@/lib/types";

/** 휴가·녹화·주조 등 이미지 전용 업로드 */
const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/x-ms-bmp,.bmp";

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: "work-schedule", label: "근무표", description: "직원 근무 일정" },
  { value: "vacation", label: "휴가", description: "휴가 신청 및 일정" },
  { value: "office-schedule", label: "사무실일정", description: "사무실 촬영 및 일정" },
  { value: "production-schedule", label: "제작일정", description: "제작 촬영 및 일정" },
];

type UploadState = "idle" | "uploading" | "success" | "error";

type WorkScheduleKind = "office" | "production" | "casting";

const UPLOAD_OK_STORAGE = "planner_upload_ok";

interface StoredUploadSuccess {
  summary: string;
  hadImage: boolean;
  docType: string;
  recordingWeek: "this-week" | "other-week" | null;
  recordingEffectiveDate: string | null;
}

export default function UploadForm() {
  const [documentType, setDocumentType] = useState<DocumentType>("work-schedule");
  const [workScheduleKind, setWorkScheduleKind] = useState<WorkScheduleKind>("office");
  const [vacationKind, setVacationKind] = useState<VacationKind>("office");
  const [memo, setMemo] = useState("");
  const [recordingProgram, setRecordingProgram] = useState("");
  const [recordingDate, setRecordingDate] = useState("");
  const [recordingTime, setRecordingTime] = useState("");
  const [recordingPlace, setRecordingPlace] = useState("");
  const [recordingNote, setRecordingNote] = useState("");
  const [vacationPerson, setVacationPerson] = useState("");
  const [vacationDateStart, setVacationDateStart] = useState("");
  const [vacationDateEnd, setVacationDateEnd] = useState("");
  const [vacationNote, setVacationNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmitHadImage, setLastSubmitHadImage] = useState(false);
  const [lastSubmitDocType, setLastSubmitDocType] = useState<DocumentType | null>(null);
  const [lastRecordingWeek, setLastRecordingWeek] = useState<
    "this-week" | "other-week" | null
  >(null);
  const [lastRecordingEffectiveDate, setLastRecordingEffectiveDate] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadOkHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ok") !== "1") return;
    if (uploadOkHydratedRef.current) return;
    uploadOkHydratedRef.current = true;

    let data: StoredUploadSuccess | null = null;
    try {
      const raw = sessionStorage.getItem(UPLOAD_OK_STORAGE);
      if (raw) {
        data = JSON.parse(raw) as StoredUploadSuccess;
        sessionStorage.removeItem(UPLOAD_OK_STORAGE);
      }
    } catch {
      sessionStorage.removeItem(UPLOAD_OK_STORAGE);
    }

    if (data) {
      setLastSubmitHadImage(data.hadImage);
      setLastSubmitDocType(data.docType as DocumentType);
      setLastRecordingWeek(data.recordingWeek);
      setLastRecordingEffectiveDate(data.recordingEffectiveDate);
      setResultSummary(data.summary);
    } else {
      setLastSubmitHadImage(false);
      setLastSubmitDocType(null);
      setLastRecordingWeek(null);
      setLastRecordingEffectiveDate(null);
      setResultSummary("저장이 완료되었습니다.");
    }
    setUploadState("success");
    window.history.replaceState(null, "", "/submit");
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadState("idle");
    setResultSummary(null);
    setErrorMessage(null);

    const looksLikeImage =
      file.type.startsWith("image/") || /\.bmp$/i.test(file.name);
    if (looksLikeImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const isCasting = documentType === "work-schedule" && workScheduleKind === "casting";

  const recordingFormReady =
    recordingProgram.trim().length > 0 && recordingDate.trim().length > 0;

  const isOfficeSchedule = documentType === "office-schedule";
  const isProductionSchedule = documentType === "production-schedule";

  const vacationFormReady =
    vacationPerson.trim().length > 0 && vacationDateStart.trim().length > 0;

  const canSubmit = isCasting
    ? Boolean(selectedFile)
    : isOfficeSchedule || isProductionSchedule
      ? Boolean(selectedFile) || recordingFormReady
      : documentType === "vacation"
        ? Boolean(selectedFile) || vacationFormReady
        : Boolean(selectedFile) || memo.trim().length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

      if (!canSubmit) {
      setErrorMessage(
        isOfficeSchedule || isProductionSchedule && !selectedFile
          ? "프로그램과 날짜를 입력하거나, 이미지를 선택해 주세요."
          : documentType === "vacation" && !selectedFile
            ? "휴가자·시작일을 입력하거나, 이미지를 선택해 주세요."
            : "이미지를 선택하거나 메모를 입력해 주세요."
      );
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);
    setResultSummary(null);
    setLastRecordingWeek(null);
    setLastRecordingEffectiveDate(null);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("image", selectedFile);
      }
      // 주조 근무표는 실제 API에 casting-schedule 타입으로 전송
      const submitDocType = isCasting ? "casting-schedule" : documentType;
      formData.append("documentType", submitDocType);
      formData.append("memo", memo);
      if (documentType === "work-schedule" && !isCasting) {
        formData.append("workScheduleKind", workScheduleKind);
      }
      if (documentType === "vacation") {
        formData.append("vacationKind", vacationKind);
      }
      if (isOfficeSchedule || isProductionSchedule) {
        formData.append("recordingProgram", recordingProgram);
        formData.append("recordingDate", recordingDate);
        formData.append("recordingTime", recordingTime);
        formData.append("recordingPlace", recordingPlace);
        formData.append("recordingNote", recordingNote);
        formData.append(
          "scheduleType",
          documentType === "office-schedule" ? "office" : "production"
        );
      }
      if (documentType === "vacation") {
        formData.append("vacationPerson", vacationPerson);
        formData.append("vacationDateStart", vacationDateStart);
        formData.append("vacationDateEnd", vacationDateEnd);
        formData.append("vacationNote", vacationNote);
      }

      const response = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const raw = await response.text();
      let result: SubmitApiResponse;
      try {
        result = JSON.parse(raw) as SubmitApiResponse;
      } catch {
        setUploadState("error");
        setErrorMessage(
          `서버 응답을 처리할 수 없습니다 (${response.status}). ${raw.slice(0, 120)}`
        );
        return;
      }

      if (result.success) {
        const summaryText =
          result.summary ?? (selectedFile ? "처리 완료" : "메모가 저장되었습니다.");
        const payload: StoredUploadSuccess = {
          summary: summaryText,
          hadImage: Boolean(selectedFile),
          docType: String(submitDocType),
          recordingWeek:
            isOfficeSchedule || isProductionSchedule
              ? result.recordingWeek ?? null
              : null,
          recordingEffectiveDate:
            isOfficeSchedule || isProductionSchedule
              ? result.recordingEffectiveDate ?? null
              : null,
        };
        try {
          sessionStorage.setItem(UPLOAD_OK_STORAGE, JSON.stringify(payload));
        } catch {
          /* private 모드 등 */
        }
        window.location.replace("/submit?ok=1");
        return;
      } else {
        setUploadState("error");
        setErrorMessage(
          result.error ?? `요청 실패 (${response.status})`
        );
      }
    } catch (err) {
      setUploadState("error");
      const msg =
        err instanceof Error ? err.message : String(err);
      setErrorMessage(
        msg.includes("fetch") || msg.includes("Load failed") || msg.includes("NetworkError")
          ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
          : msg
      );
    }
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(UPLOAD_OK_STORAGE);
    } catch {
      /* ignore */
    }
    setUploadState("idle");
    setResultSummary(null);
    setErrorMessage(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setMemo("");
    setRecordingProgram("");
    setRecordingDate("");
    setRecordingTime("");
    setRecordingPlace("");
    setRecordingNote("");
    setVacationPerson("");
    setVacationDateStart("");
    setVacationDateEnd("");
    setVacationNote("");
    setLastSubmitDocType(null);
    setLastSubmitHadImage(false);
    setLastRecordingWeek(null);
    setLastRecordingEffectiveDate(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {uploadState === "success" ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-green-800 mb-2">업로드 완료</h3>
          <p className="text-green-700 mb-1 text-sm">
            {lastSubmitHadImage
              ? lastSubmitDocType === "work-schedule"
                ? "근무표 이미지가 저장되었습니다."
                : "AI 분석 결과가 GitHub에 저장되었습니다."
              : lastSubmitDocType === "office-schedule" || lastSubmitDocType === "production-schedule"
                ? "일정이 GitHub에 저장되었습니다."
                : lastSubmitDocType === "vacation"
                  ? "휴가 일정이 GitHub에 저장되었습니다."
                  : "메모 내용이 GitHub에 저장되었습니다."}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v3m0 6v3m6-6h-3m-6 0H3m12.364-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121m0-12.728l2.121 2.121m8.486 8.486l2.121 2.121" />
            </svg>
            홈 화면 반영까지 보통 몇 초가 걸립니다
          </div>
          {(lastSubmitDocType === "office-schedule" || lastSubmitDocType === "production-schedule") &&
            lastRecordingWeek &&
            lastRecordingEffectiveDate && (
              <p className="text-green-800 text-sm mt-3 px-1 leading-relaxed text-left max-w-2xl mx-auto">
                기준일{" "}
                <span className="font-mono font-semibold">{lastRecordingEffectiveDate}</span>
                은(는) 오늘(서울) 기준{" "}
                {lastRecordingWeek === "this-week" ? (
                  <>
                    <strong>이번 주(월~일)</strong>에 속합니다. 홈 화면의{" "}
                    <strong>이번 주 일정</strong> 블록에 표시됩니다.
                  </>
                ) : (
                  <>
                    <strong>이번 주가 아닙니다</strong>. 홈 화면의{" "}
                    <strong>이번 주 외 일정</strong> 블록에 표시됩니다.
                  </>
                )}
                <span className="block text-xs text-green-700/80 mt-1.5 font-normal">
                  방송일이 여러 개면 첫 날짜를 기준으로 안내합니다. 날짜가 없으면 업로드일(서울)을
                  사용합니다.
                </span>
              </p>
            )}
          {resultSummary && (
            <div className="mt-4 bg-white rounded-xl p-4 border border-green-100 text-left">
              <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                {lastSubmitDocType === "work-schedule" && lastSubmitHadImage
                  ? "등록 정보"
                  : lastSubmitDocType === "office-schedule" || lastSubmitDocType === "production-schedule" && !lastSubmitHadImage
                    ? "등록 요약"
                    : lastSubmitDocType === "vacation" && !lastSubmitHadImage
                      ? "등록 요약"
                      : "AI 요약"}
              </p>
              <p className="text-gray-800 text-sm">{resultSummary}</p>
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-6 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
          >
            새 파일 업로드
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 문서 종류 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              문서 종류 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setDocumentType(type.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    documentType === type.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">{type.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {documentType === "vacation" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                휴가 구분 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setVacationKind("office")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    vacationKind === "office"
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">사무실 휴가</div>
                  <div className="text-xs mt-0.5 opacity-80">일반 사무실</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVacationKind("production")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    vacationKind === "production"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">제작 휴가</div>
                  <div className="text-xs mt-0.5 opacity-80">방송 제작</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVacationKind("casting")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    vacationKind === "casting"
                      ? "border-orange-500 bg-orange-50 text-orange-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">주조 휴가</div>
                  <div className="text-xs mt-0.5 opacity-80">주조 근무표와 동일 열에 표시</div>
                </button>
              </div>
            </div>
          )}

          {documentType === "work-schedule" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                근무표 종류 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setWorkScheduleKind("office")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    workScheduleKind === "office"
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">사무실 근무표</div>
                  <div className="text-xs mt-0.5 opacity-80">일반 사무실 근무</div>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkScheduleKind("production")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    workScheduleKind === "production"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">제작 근무표</div>
                  <div className="text-xs mt-0.5 opacity-80">D/N 구분 (오전·오후)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkScheduleKind("casting")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    workScheduleKind === "casting"
                      ? "border-orange-500 bg-orange-50 text-orange-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">주조 근무표</div>
                  <div className="text-xs mt-0.5 opacity-80">휴가·대근 자동 추출</div>
                </button>
              </div>
            </div>
          )}

          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              이미지{" "}
              <span className="text-gray-400 font-normal">
                {isCasting
                  ? "(필수 · 주조 근무표 이미지)"
                  : documentType === "work-schedule"
                    ? "(선택 · 메모만으로도 등록 가능)"
                    : documentType === "vacation"
                      ? "(선택 · 폼만으로도 등록 가능)"
                      : "(선택 · 메모만으로도 등록 가능)"}
              </span>
            </label>
            {isCasting && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                주조 근무표 이미지를 업로드하면 원본 이미지가 그대로 저장되고, 하단 휴가/대근 테이블이 자동 추출됩니다.
              </p>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  documentType === "vacation" ? undefined : IMAGE_ACCEPT
                }
                onChange={handleFileChange}
                className="hidden"
              />
              {previewUrl ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="미리보기"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-blue-600 font-medium">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">클릭하여 다른 파일 선택</p>
                </div>
              ) : selectedFile && !selectedFile.type.startsWith("image/") ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-800 break-all px-2">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">클릭하여 다른 파일 선택</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">
                    {documentType === "vacation"
                      ? "클릭하여 이미지 또는 엑셀 선택"
                      : "클릭하여 이미지 선택"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {documentType === "vacation"
                      ? "JPEG, PNG, WEBP, GIF, BMP, Excel(xlsx, xls) · 최대 10MB"
                      : "JPEG, PNG, WEBP, GIF, BMP · 최대 10MB"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 녹화일정: 구조화 폼 / 그 외: 메모 (주조 근무표 제외) */}
          {!isCasting && documentType === "vacation" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                이미지 없이 등록할 때는 <strong>휴가자</strong>와 <strong>시작일</strong>이 필요합니다.
                하루만 쓸 때는 종료일을 비우면 됩니다. 연일이면 종료일까지 선택하세요.
                <span className="block mt-1">
                  엑셀(xlsx, xls)은 <strong>1행 헤더, 2행부터 데이터</strong>, 고정 열: B 이름, C 구분, D
                  시작일, E 시작 요일, F 종료일, G 종료 요일, H 휴가 일수, I 비고. 날짜는 셀 서식·텍스트
                  모두 인식합니다. 데이터 행마다 레코드 1건이 등록됩니다.
                </span>
                이미지를 올리면 AI가 표를 읽고, 아래 폼을 함께 쓰면 그 내용이 병합됩니다.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    휴가자 <span className="text-red-500">*</span>
                    {!selectedFile && (
                      <span className="text-gray-400 font-normal"> (이미지 없을 때 필수)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={vacationPerson}
                    onChange={(e) => setVacationPerson(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    시작일 <span className="text-red-500">*</span>
                    {!selectedFile && (
                      <span className="text-gray-400 font-normal"> (이미지 없을 때 필수)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={vacationDateStart}
                    onChange={(e) => {
                      setVacationDateStart(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    종료일{" "}
                    <span className="text-gray-400 font-normal text-xs">
                      (비우면 시작일 하루만)
                    </span>
                  </label>
                  <input
                    type="date"
                    value={vacationDateEnd}
                    min={vacationDateStart || undefined}
                    onChange={(e) => setVacationDateEnd(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">비고</label>
                  <textarea
                    value={vacationNote}
                    onChange={(e) => setVacationNote(e.target.value)}
                    placeholder="사유 등 추가 안내"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {!isCasting && (isOfficeSchedule || isProductionSchedule) && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                이미지 없이 등록할 때는 <strong>{isOfficeSchedule ? "일정" : "프로그램"}</strong>과 <strong>날짜</strong>가 필요합니다.
                이미지를 함께 올리면 AI 분석에 더해 아래 내용이 일정에 반영됩니다.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {isOfficeSchedule ? "일정" : "프로그램"} <span className="text-red-500">*</span>
                    {!selectedFile && <span className="text-gray-400 font-normal"> (이미지 없을 때 필수)</span>}
                  </label>
                  <input
                    type="text"
                    value={recordingProgram}
                    onChange={(e) => setRecordingProgram(e.target.value)}
                    placeholder={isOfficeSchedule ? "예: 편성회의" : "예: 즐거운 오후"}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    날짜 <span className="text-red-500">*</span>
                    {!selectedFile && <span className="text-gray-400 font-normal"> (이미지 없을 때 필수)</span>}
                  </label>
                  <input
                    type="date"
                    value={recordingDate}
                    onChange={(e) => setRecordingDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">시간</label>
                  <input
                    type="text"
                    value={recordingTime}
                    onChange={(e) => setRecordingTime(e.target.value)}
                    placeholder="예: 14:00–16:00"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">장소</label>
                  <input
                    type="text"
                    value={recordingPlace}
                    onChange={(e) => setRecordingPlace(e.target.value)}
                    placeholder="예: 1스튜디오"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">비고</label>
                  <textarea
                    value={recordingNote}
                    onChange={(e) => setRecordingNote(e.target.value)}
                    placeholder="추가 안내가 있으면 입력하세요"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {!isCasting && documentType !== "office-schedule" && documentType !== "production-schedule" && documentType !== "vacation" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                메모{" "}
                <span className="text-gray-400 font-normal">
                  (선택 · 이미지 없이 메모만 입력해도 등록됩니다)
                </span>
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 4/14 14:05 즐거운 오후 녹화 / 또는 이미지 없이 일정만 적어도 됩니다"
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* 업로드 진행 (바) */}
          {uploadState === "uploading" && (
            <div className="space-y-2">
              <p className="text-xs text-center text-gray-600 font-medium">
                {selectedFile
                  ? documentType === "work-schedule" && selectedFile.type.startsWith("image/")
                    ? "저장 중..."
                    : selectedFile.type.startsWith("image/")
                      ? "AI 분석 중..."
                      : "문서 분석 중..."
                  : documentType === "office-schedule" || documentType === "production-schedule" || documentType === "vacation"
                    ? "저장 중..."
                    : "저장 중..."}
              </p>
              <div
                className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-busy="true"
                aria-label="업로드 진행 중"
              >
                <div className="absolute inset-y-0 left-0 w-[35%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-sm upload-bar-indeterminate" />
              </div>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={uploadState === "uploading" || !canSubmit}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {uploadState === "uploading" ? (
              "처리 중..."
            ) : (
              selectedFile
                ? isCasting
                  ? "업로드 및 분석"
                  : documentType === "work-schedule" && selectedFile.type.startsWith("image/")
                    ? "이미지 업로드"
                    : documentType === "work-schedule" && !selectedFile.type.startsWith("image/")
                      ? "문서 업로드 및 분석"
                      : "업로드 및 분석"
                : documentType === "office-schedule" || documentType === "production-schedule"
                  ? "일정 등록"
                  : documentType === "vacation"
                    ? "휴가 등록"
                    : "메모만 저장"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
