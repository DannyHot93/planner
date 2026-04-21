import { revalidateTag } from "next/cache";

/** `lib/github.ts` 읽기 전용 fetch와 동일한 태그 — 삭제·수정·등록 후 즉시 목록 갱신 */
export const PLANNER_RECORDS_CACHE_TAG = "planner-records";

/**
 * GitHub `readRecordsFromGitHub`용 데이터 캐시만 무효화한다.
 *
 * `revalidatePath("/", …)` 는 전체 라우트 ISR을 매번 다시 써서 ISR Writes·Origin
 * 전송이 크게 늘었다. 태그 무효화만으로 GitHub `fetch`·`/api/planner-data`의
 * `unstable_cache`가 다음 요청에서 다시 채워지도록 한다. (`/` HTML은 static)
 */
export function revalidatePlannerHome(): void {
  revalidateTag(PLANNER_RECORDS_CACHE_TAG, "default");
}
