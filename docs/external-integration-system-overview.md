# 외부 프로그램 연동 및 시스템 개요

이 문서는 일정 플래너를 외부 프로그램과 연동하거나, 추후 다른 시스템과 호환성을 확장할 때 참고하기 위한 운영/개발 요약 문서입니다.

## 1. 시스템 한 줄 요약

일정 플래너는 Next.js/Vercel 앱이며, 일정 데이터는 GitHub 저장소의 `data/*.json` 파일을 원본 저장소처럼 사용합니다. 외부 프로그램은 일정 확정 시 `POST /api/webhook/records`로 JSON을 보내고, 일정 플래너는 이를 기존 일정 레코드 형식으로 변환해 GitHub JSON 파일에 생성 또는 갱신합니다.

## 2. 전체 구성

| 영역 | 현재 역할 |
| --- | --- |
| Next.js App Router | 화면, API Route, 서버 로직 |
| Vercel | 앱 배포, 서버리스 함수 실행, 환경변수 관리 |
| GitHub Contents API | `data/*.json` 일정 파일 읽기/쓰기 |
| Gemini | 이미지 업로드 일정 분석 |
| Google Calendar API | 사무실 일정 읽기 전용 합산 |
| Vercel Blob | 선택 사항. 업로드 이미지 저장 |

## 3. 주요 화면과 API

| 경로 | 역할 |
| --- | --- |
| `/` | 일반 일정판 |
| `/display` | 상시 모니터/TV용 디스플레이 화면 |
| `/submit` | 이미지 업로드 또는 직접 입력 등록 화면 |
| `GET /api/planner-data` | 홈/디스플레이 화면이 읽는 통합 일정 JSON |
| `POST /api/submit` | 내부 화면에서 이미지/폼으로 등록 |
| `POST /api/webhook/records` | 외부 프로그램에서 JSON으로 일정 등록/수정 |
| `GET/POST /api/cleanup` | 지난 일정 정리 |
| `PATCH/DELETE /api/records/[id]` | 일정 수정/삭제 |

## 4. 데이터 저장 구조

운영 저장 경로는 GitHub 저장소의 JSON 파일입니다.

| 파일 | 저장 데이터 |
| --- | --- |
| `data/work-schedules.json` | 근무표 |
| `data/vacations.json` | 휴가 |
| `data/office-schedules.json` | 사무실 일정 |
| `data/production-schedules.json` | 제작 일정 |
| `data/recordings.json` | 레거시 녹화 일정 |
| `data/casting-schedules.json` | 주조/캐스팅 일정 |
| `data/shared-memo.json` | 공유 메모 |

저장은 `lib/github.ts`의 GitHub Contents API helper를 통해 처리합니다. 파일 업데이트 시 GitHub 커밋이 생성되며, 409 conflict가 발생하면 짧게 대기 후 재시도합니다.

하루 10건 안팎의 외부 webhook이라면 현재 GitHub JSON 방식으로 충분히 운영 가능합니다. 하루 수십~수백 건 이상으로 늘어나거나 동시 수정이 잦아지면 Supabase/PostgreSQL 같은 DB 이전을 검토합니다.

## 5. 통합 일정 응답 흐름

`GET /api/planner-data`는 다음 데이터를 합쳐 화면에 전달합니다.

1. GitHub의 `data/*.json` 파일을 읽습니다.
2. 지난 휴가와 지난 제작/사무실 일정은 화면 응답에서 제외합니다.
3. Google Calendar 설정이 있으면 사무실 일정에 읽기 전용으로 합산합니다.
4. 이미지 base64 등 큰 필드는 제거해 응답 크기를 줄입니다.
5. `/display`는 이 API를 주기적으로 폴링해 화면을 갱신합니다.

## 6. 지난 일정 정리 정책

`/api/cleanup`은 운영 데이터가 계속 쌓이지 않도록 GitHub JSON 파일에서 지난 일정을 실제 제거합니다.

| 데이터 | 정리 기준 |
| --- | --- |
| 휴가 | 오늘 기준 이미 끝난 휴가 제거 |
| 사무실/제작/레거시 녹화 일정 | 이번 주 월요일 이전 일정 제거. 직전 주 일정은 일요일까지 유지하고 월요일부터 제거 |

Vercel Cron에서 `GET /api/cleanup`을 호출할 수 있으며, `CRON_SECRET`이 설정된 경우 `Authorization: Bearer ...` 인증이 필요합니다.

## 7. Webhook 연동 개요

외부 프로그램은 일정이 확정되거나 재승인될 때 다음 엔드포인트로 POST합니다.

```text
POST https://planner-ecru-beta.vercel.app/api/webhook/records
```

필수 헤더:

```http
Authorization: Bearer 실제_WEBHOOK_SECRET값
Content-Type: application/json
```

인증 기준:

| 상황 | 응답 |
| --- | --- |
| `WEBHOOK_SECRET` 서버 환경변수 없음 | `503` |
| Authorization 없음/불일치 | `401` |
| JSON 형식 오류 또는 필수 필드 누락 | `400` |
| 정상 생성/수정 | `200` |

## 8. Webhook upsert 방식

외부 프로그램은 자신의 일정 UUID를 `external_id`로 보냅니다.

```json
{
  "external_id": "외부프로그램-schedule-uuid"
}
```

일정 플래너 동작:

| 조건 | 동작 |
| --- | --- |
| 같은 `external_id` 없음 | 새 일정 생성, 응답 `action: "created"` |
| 같은 `external_id` 있음 | 기존 일정 업데이트, 응답 `action: "updated"` |
| `external_id` 없음 | 기존 방식처럼 매 요청마다 새 일정 생성 |

업데이트 시 우리 쪽 기존 `id`, `uploadedAt`은 유지합니다. 따라서 화면의 수정/삭제 기준 id가 불필요하게 바뀌지 않습니다.

## 9. 권장 webhook JSON

제작 일정 확정 시 권장 payload입니다.

```json
{
  "type": "production-schedule",
  "summary": "전국시대 · 2026-07-13 11:00",
  "external_id": "76eec923-9864-466b-b723-57e3bd48c2fe",
  "details": {
    "title": "전국시대",
    "program": "전국시대",
    "entries": [
      {
        "date": "2026-07-13",
        "time": "11:00",
        "place": "4층 뉴스센터",
        "person": "담당PD 홍길동",
        "note": "스튜디오 / 방송: 2026-07-14 09:00"
      }
    ]
  }
}
```

필드 의미:

| 필드 | 권장 여부 | 설명 |
| --- | --- | --- |
| `type` | 필수 | `production-schedule`, `office-schedule`, `vacation`, `work-schedule`, `casting-schedule` 중 하나 |
| `summary` | 필수 | 짧은 요약. 예: `프로그램명 · YYYY-MM-DD HH:mm` |
| `external_id` | 권장 | 외부 프로그램의 일정 UUID. upsert 기준 |
| `memo` | 선택 | 레코드 전체 메모 |
| `details.title` | 강력 권장 | 화면 카드 제목으로 쓰는 프로그램명 |
| `details.program` | 권장 | `title`과 같은 값 권장 |
| `details.entries[].date` | 필수 권장 | 일정 날짜 `YYYY-MM-DD` |
| `details.entries[].time` | 권장 | 일정 시간. 예: `11:00`, `14:00-15:00` |
| `details.entries[].place` | 권장 | 장소 |
| `details.entries[].person` | 권장 | 담당자/PD/출연자 등 |
| `details.entries[].note` | 선택 | 장비, 옵션, 방송일시, 추가 메모 |

화면 카드 제목은 `details.title` 또는 `details.program`을 우선 사용합니다. 이 값이 없으면 `entry.note`가 제목처럼 보일 수 있으므로 외부 프로그램은 반드시 `details.title` 또는 `details.program`을 보내는 것이 좋습니다.

담당자 정보는 `entries[].person`에 넣는 것을 권장합니다. 확실히 메모 영역에도 노출하고 싶다면 `note`에도 같은 정보를 짧게 포함할 수 있습니다.

## 10. 여러 날짜 일정

하나의 외부 일정이 여러 날짜에 표시되어야 하면 `entries`를 여러 개 보냅니다.

```json
{
  "type": "production-schedule",
  "summary": "프라임 인터뷰 · 4건",
  "external_id": "prime-interview-series-uuid",
  "details": {
    "title": "프라임 인터뷰",
    "program": "프라임 인터뷰",
    "entries": [
      { "date": "2026-07-15", "time": "14:00-15:00", "place": "4층 스튜디오", "person": "담당PD 민수빈", "note": "방송: 2026-07-25" },
      { "date": "2026-07-23", "time": "14:00-15:00", "place": "4층 스튜디오", "person": "담당PD 민수빈", "note": "방송: 2026-08-01" },
      { "date": "2026-07-29", "time": "14:00-15:00", "place": "4층 스튜디오", "person": "담당PD 민수빈", "note": "방송: 2026-08-08" },
      { "date": "2026-08-03", "time": "14:00-15:00", "place": "4층 스튜디오", "person": "담당PD 민수빈", "note": "방송: 2026-08-15" }
    ]
  }
}
```

## 11. 외부 프로그램 fetch 예시

환경변수 방식:

```ts
const res = await fetch("https://planner-ecru-beta.vercel.app/api/webhook/records", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.WEBHOOK_SECRET}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "production-schedule",
    summary: "전국시대 · 2026-07-13 11:00",
    external_id: schedule.id,
    details: {
      title: "전국시대",
      program: "전국시대",
      entries: [
        {
          date: "2026-07-13",
          time: "11:00",
          place: "4층 뉴스센터",
          person: "담당PD 홍길동",
          note: "스튜디오 / 방송: 2026-07-14 09:00",
        },
      ],
    },
  }),
});

console.log(res.status, await res.json());
```

응답 예시:

```json
{
  "success": true,
  "id": "ps_1783578488584_ae31e09c",
  "external_id": "76eec923-9864-466b-b723-57e3bd48c2fe",
  "action": "created",
  "summary": "전국시대 · 2026-07-13 11:00"
}
```

같은 `external_id`로 다시 보내면 `action`은 `updated`가 됩니다.

## 12. 보안/운영 주의사항

- `WEBHOOK_SECRET`은 우리 Vercel과 외부 프로그램 Vercel에 같은 값으로 설정합니다.
- 코드에 secret을 직접 넣는 방식은 테스트 용도 외에는 권장하지 않습니다.
- secret이 노출되면 즉시 교체합니다.
- Vercel 로그에는 요청 body JSON이 자동 저장되지 않습니다. 실제 payload 확인은 저장된 GitHub JSON 커밋으로 확인합니다.
- webhook 성공 여부는 Vercel 로그에서 `POST /api/webhook/records 200`으로 확인합니다.
- `GET /api/webhook/records 405`는 주소를 브라우저로 열었거나 GET으로 호출한 경우이며 정상 등록이 아닙니다.

## 13. 운영 확인 방법

최근 webhook 로그:

```bash
vercel logs --environment production --since 4h --query /api/webhook/records --limit 100 --no-follow
```

GitHub 데이터 변경 이력:

```bash
git log --oneline -- data/production-schedules.json data/office-schedules.json data/vacations.json
```

특정 자동 커밋의 JSON 변경 확인:

```bash
git show -- data/production-schedules.json
```

## 14. 확장 포인트

현재 구조에서 외부 프로그램 호환성을 넓히려면 다음 순서가 좋습니다.

1. webhook payload 필드를 명확히 유지합니다.
2. `external_id` 기반 upsert를 모든 외부 일정에 사용합니다.
3. `details.title`, `entries[].person`, `entries[].place`, `entries[].note`를 표준으로 삼습니다.
4. 외부 프로그램별로 필드명이 다르면 `app/api/webhook/records/route.ts`에서 normalize layer를 추가합니다.
5. 하루 수십~수백 건 이상으로 증가하면 GitHub JSON 대신 DB 저장소를 도입합니다.

## 15. 현재 권장 운영 판단

현재 예상 사용량이 하루 10건 안팎이면 GitHub JSON 저장 방식은 충분히 현실적입니다. 자동 커밋이 늘어나지만 변경 이력과 복구 가능성이 생기는 장점이 더 큽니다. 다만 일정 수정 빈도와 webhook 실패 로그는 주기적으로 확인하는 것이 좋습니다.

