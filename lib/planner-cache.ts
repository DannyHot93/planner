import { revalidatePath, revalidateTag } from "next/cache";

/** `lib/github.ts` 읽기 전용 fetch와 동일한 태그 — 삭제·수정·등록 후 즉시 목록 갱신 */
export const PLANNER_RECORDS_CACHE_TAG = "planner-records";

/** 홈 및 GitHub JSON 데이터 캐시 무효화 */
export function revalidatePlannerHome(): void {
  revalidateTag(PLANNER_RECORDS_CACHE_TAG, "default");
  revalidatePath("/", "layout");
  revalidatePath("/");
}
