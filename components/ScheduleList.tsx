import { ScheduleRecord, DocumentType } from "@/lib/types";

const TYPE_LABEL: Record<DocumentType, string> = {
  "work-schedule": "근무표",
  vacation: "휴가",
  recording: "녹화일정",
};

const TYPE_COLOR: Record<DocumentType, string> = {
  "work-schedule": "bg-blue-100 text-blue-700",
  vacation: "bg-green-100 text-green-700",
  recording: "bg-purple-100 text-purple-700",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecordCard({ record }: { record: ScheduleRecord }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLOR[record.type]}`}
        >
          {TYPE_LABEL[record.type]}
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatDate(record.uploadedAt)}
        </span>
      </div>

      <p className="text-gray-800 text-sm font-medium mb-2">{record.summary}</p>

      {record.memo && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          메모: {record.memo}
        </p>
      )}

      {"period" in record.details && record.details.period && (
        <p className="text-xs text-gray-400 mt-2">
          기간: {record.details.period as string}
        </p>
      )}
    </div>
  );
}

interface ScheduleListProps {
  records: ScheduleRecord[];
  activeTab: DocumentType | "all";
}

export default function ScheduleList({ records, activeTab }: ScheduleListProps) {
  const filtered =
    activeTab === "all"
      ? records
      : records.filter((r) => r.type === activeTab);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm">등록된 일정이 없습니다.</p>
        <p className="text-xs mt-1">
          <a href="/submit" className="text-blue-500 hover:underline">
            일정 업로드
          </a>
          에서 이미지를 업로드해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {filtered.map((record) => (
        <RecordCard key={record.id} record={record} />
      ))}
    </div>
  );
}
