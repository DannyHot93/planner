# Planner — 압축 컨텍스트 (에이전트 핸드오프)

> **목적:** 토큰을 적게 쓰면서도 재발 방지·아키텍처 불변식을 유지한다.  
> **요약 기준:** 중요도·의존 관계 우선 (시간순 아님).

---

## 1) 불변식 (반드시 먼저 읽기)

- **Next.js 16** App Router. 공식 API는 `node_modules/next/dist/docs/` 기준 (AGENTS.md).
- **데이터:** GitHub에 JSON (`data/work-schedules.json`, `vacations.json`, `recordings.json`, `casting-schedules.json`). `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` 필수.
- **Gemini 연동 시** 사용자 규칙: 모델 `gemini-2.5-flash` (이 저장소는 주로 OpenAI 사용).
- **Submit `/api/submit`:** `sharp` / `pdf-parse` / vision 전처리는 **해당 분기에서만** `import()` — 이미지 없는 녹화·휴가·메모 제출이 네이티브 모듈 로드로 500 HTML 나지 않게.

---

## 2) 도메인 모델 (짧게)

| 구분 | 저장 | 비고 |
|------|------|------|
| 근무표 | `work-schedule` | PDF/docx/이미지, 종류 office/production |
| 휴가 | `vacation` | 폼: 휴가자·시작·종료(선택)·비고. `VacationKind`: **office \| production \| casting** |
| 주조표 이미지 | `casting-schedule` | AI가 하단 표 추출 → `casting-schedules.json` |
| 녹화 | `recording` | 폼 또는 이미지+AI. 주 구간은 `lib/recording-week.ts` |

**주조 휴가 UI:** `VacationWeekView` 주조 열 = `vacations.json`에서 `vacationKind: casting` + `casting-schedules.json` 합침. 폼으로 넣은 주조만 `vac_*` **삭제 버튼** 노출.

---

## 3) 수정 시 볼 파일 (우선순위)

1. `app/api/submit/route.ts` — 폼 필드, 동적 import, GitHub 저장
2. `lib/normalize.ts` — 레코드 shape, 휴가/녹화 빌더
3. `lib/types.ts` — `VacationKind`, `SubmitApiResponse` 등
4. `components/UploadForm.tsx` — 문서 종류·휴가 구분·폼
5. `components/VacationWeekView.tsx` / `RecordingWeekView.tsx` — 주간 뷰
6. `lib/github.ts` — 읽기/쓰기, 대용량은 blob API

---

## 4) 의도적으로 짧게 남긴 것 (검색으로 복구)

- Vercel 배포 URL, 특정 커밋 해시
- 긴 에러 스택, 대화 전체
- `casting-schedules.json` 용량 (매우 클 수 있음 — 직접 열지 말고 필요 시 부분만)

---

## 5) 새 세션용 원라인 프롬프트 (복사용)

```
planner: Next.js16+GitHub JSON. Submit은 중량 deps 동적 import. 휴가 VacationKind에 casting 있음—vacations.json 주조는 주조 열+삭제. 녹화는 recording-week. 변경은 submit/normalize/types/UploadForm/WeekView 순.
```

---

*갱신 시: 날짜와 “무엇이 바뀌었는지” 한 줄만 상단에 추가.*
