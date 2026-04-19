import NavigateHomeLink from "@/components/NavigateHomeLink";
import UploadForm from "@/components/UploadForm";

export const metadata = {
  title: "일정 업로드 | 플래너",
  description: "근무표, 휴가, 녹화일정 이미지를 업로드하여 AI로 분석합니다.",
};

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-12">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <NavigateHomeLink className="group relative inline-flex items-center gap-2 px-5 py-2.5 mb-6 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 ring-2 ring-blue-300 ring-offset-2 ring-offset-slate-50 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-blue-400 transition-all">
            <span className="absolute -inset-1 rounded-2xl bg-blue-400/30 blur opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
            <svg className="relative w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="relative">일정 보기로 돌아가기</span>
          </NavigateHomeLink>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">일정 업로드</h1>
          <p className="text-gray-500 text-sm">
            이미지를 올리면 AI가 분석하고, 메모만 입력해도 바로 등록할 수 있습니다.
          </p>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <UploadForm />
        </div>

        {/* 안내 */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">업로드 안내</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 근무표는 사무실/제작을 선택할 수 있고, 이미지만 업로드할 수 있습니다.</li>
            <li>• 이미지 없이 메모만 입력해도 같은 방식으로 GitHub에 저장됩니다 (AI 분석 없음).</li>
            <li>• 이미지는 서버에 저장되지 않으며 AI 분석 후 즉시 삭제됩니다.</li>
            <li>• 분석 결과는 GitHub 저장소에 저장되고 자동 배포됩니다.</li>
            <li>• 지원 형식: JPEG, PNG, WEBP, GIF (최대 10MB). 휴가는 Excel(xlsx, xls)도 업로드할 수 있습니다.</li>
            <li>• 이미지 분석에는 약 10~30초가 소요될 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
