import ScheduleListClient from "@/components/ScheduleListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "일정 플래너 디스플레이",
  description: "상시 모니터용 일정 플래너 화면입니다.",
};

export default function DisplayPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6">
        <ScheduleListClient forceDisplayMode />
      </div>
    </div>
  );
}
