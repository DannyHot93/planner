"use client";

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { DocumentType, SubmitApiResponse } from "@/lib/types";

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: "work-schedule", label: "근무표", description: "직원 근무 일정" },
  { value: "vacation", label: "휴가", description: "휴가 신청 및 일정" },
  { value: "recording", label: "녹화일정", description: "녹화 및 촬영 일정" },
];

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadForm() {
  const [documentType, setDocumentType] = useState<DocumentType>("work-schedule");
  const [memo, setMemo] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadState("idle");
    setResultSummary(null);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setErrorMessage("이미지 파일을 선택해주세요.");
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);
    setResultSummary(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("documentType", documentType);
      formData.append("memo", memo);

      const response = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const result: SubmitApiResponse = await response.json();

      if (result.success) {
        setUploadState("success");
        setResultSummary(result.summary ?? "처리 완료");
        setSelectedFile(null);
        setPreviewUrl(null);
        setMemo("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadState("error");
        setErrorMessage(result.error ?? "알 수 없는 오류가 발생했습니다.");
      }
    } catch {
      setUploadState("error");
      setErrorMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
          <p className="text-green-700 mb-1 text-sm">AI 분석 결과가 GitHub에 저장되었습니다.</p>
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

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              이미지 파일 <span className="text-red-500">*</span>
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
                accept="image/jpeg,image/png,image/webp,image/gif"
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
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">클릭하여 이미지 선택</p>
                  <p className="text-xs text-gray-400">JPEG, PNG, WEBP, GIF · 최대 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              메모 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 4월 2주차 근무표"
              rows={2}
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
            disabled={uploadState === "uploading" || !selectedFile}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {uploadState === "uploading" ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI 분석 중...
              </>
            ) : (
              "업로드 및 분석"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
