"use client";

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { DocumentType, SubmitApiResponse } from "@/lib/types";

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: "work-schedule", label: "근무표", description: "직원 근무 일정" },
  { value: "vacation", label: "휴가", description: "휴가 신청 및 일정" },
  { value: "recording", label: "녹화일정", description: "녹화 및 촬영 일정" },
];

type UploadState = "idle" | "uploading" | "success" | "error";

type WorkScheduleKind = "office" | "production";

export default function UploadForm() {
  const [documentType, setDocumentType] = useState<DocumentType>("work-schedule");
  const [workScheduleKind, setWorkScheduleKind] = useState<WorkScheduleKind>("office");
  const [memo, setMemo] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmitHadImage, setLastSubmitHadImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadState("idle");
    setResultSummary(null);
    setErrorMessage(null);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const canSubmit = Boolean(selectedFile) || memo.trim().length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      setErrorMessage("이미지를 선택하거나 메모를 입력해 주세요.");
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);
    setResultSummary(null);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("image", selectedFile);
      }
      formData.append("documentType", documentType);
      formData.append("memo", memo);
      if (documentType === "work-schedule") {
        formData.append("workScheduleKind", workScheduleKind);
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
        setLastSubmitHadImage(Boolean(selectedFile));
        setUploadState("success");
        setResultSummary(
          result.summary ?? (selectedFile ? "처리 완료" : "메모가 저장되었습니다.")
        );
        setSelectedFile(null);
        setPreviewUrl(null);
        setMemo("");
        if (fileInputRef.current) fileInputRef.current.value = "";
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
    setUploadState("idle");
    setResultSummary(null);
    setErrorMessage(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setMemo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-xl mx-auto">
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
              ? "AI 분석 결과가 GitHub에 저장되었습니다."
              : "메모 내용이 GitHub에 저장되었습니다."}
          </p>
          {resultSummary && (
            <div className="mt-4 bg-white rounded-xl p-4 border border-green-100 text-left">
              <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">AI 요약</p>
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
            <div className="grid grid-cols-3 gap-3">
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

          {documentType === "work-schedule" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                근무표 종류 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </div>
          )}

          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {documentType === "work-schedule" ? "파일" : "이미지"}{" "}
              <span className="text-gray-400 font-normal">
                (선택 · 메모만으로도 등록 가능
                {documentType === "work-schedule" ? " · 근무표는 PDF·Word도 가능" : ""})
              </span>
            </label>
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
                  documentType === "work-schedule"
                    ? "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "image/jpeg,image/png,image/webp,image/gif"
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
                    {documentType === "work-schedule"
                      ? "클릭하여 파일 선택"
                      : "클릭하여 이미지 선택"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {documentType === "work-schedule"
                      ? "JPEG, PNG, PDF, Word(docx) · 최대 10MB"
                      : "JPEG, PNG, WEBP, GIF · 최대 10MB"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 메모 */}
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

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={uploadState === "uploading" || !canSubmit}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {uploadState === "uploading" ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {selectedFile
                  ? selectedFile.type.startsWith("image/")
                    ? "AI 분석 중..."
                    : "문서 분석 중..."
                  : "저장 중..."}
              </>
            ) : (
              selectedFile
                ? documentType === "work-schedule" && !selectedFile.type.startsWith("image/")
                  ? "문서 업로드 및 분석"
                  : "업로드 및 분석"
                : "메모만 저장"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
