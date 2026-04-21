import ScheduleListClient from "@/components/ScheduleListClient";

/**
 * 데이터는 클라이언트가 `/api/planner-data` 한 번으로 가져온다.
 * 이렇게 하면 `/` HTML·ISR Writes·대형 RSC 페이로드가 새로고침마다
 * 크게 쌓이지 않는다. 갱신은 태그 무효화 + API 캐시로 처리.
 */
export const dynamic = "force-static";

export const metadata = {
  title: "일정 플래너",
  description: "근무표, 휴가, 사무실·제작 일정을 한눈에 확인하세요.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6">
        <ScheduleListClient />
      </div>
    </div>
  );
}
