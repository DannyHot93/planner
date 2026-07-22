# 일정 플래너

이미지 업로드나 직접 입력으로 근무표, 휴가, 사무실 일정, 제작 일정을 등록하고 한 화면에서 확인하는 Next.js 기반 일정판입니다. 업로드한 이미지는 Gemini로 분석해 구조화하고, 결과 데이터는 GitHub 저장소의 `data/*.json`에 저장합니다. Vercel에 연결하면 `main` 브랜치 푸시 기준으로 자동 배포됩니다.

## 주요 기능

| 영역 | 설명 |
| --- | --- |
| 홈 `/` | 일반 사용자용 일정판. 일정, 근무표, 휴가, 사무실일정, 제작일정 탭을 제공합니다. |
| 디스플레이 `/display` | 삼성 Flip Pro/Tizen 브라우저를 고려한 상시 모니터 모드입니다. 자동 갱신과 로테이션 화면을 제공합니다. |
| 업로드 `/submit` | 이미지 업로드 또는 폼 입력으로 일정을 등록합니다. 디스플레이 모드에서 이동하면 업로드 후 `/display`로 돌아옵니다. |
| 일정 탭 | 이번 주 사무실/제작 일정, 월간 캘린더, 휴가 요약을 한 화면에서 보여줍니다. |
| 사무실/제작 탭 | 이번 주 일정과 이번 달/다음 달 월간 캘린더를 보여줍니다. |
| 편집/삭제 | 일정 탭의 편집 모드에서 월간 캘린더 일정 수정/삭제가 가능하고, 사무실/제작 탭에서도 월간 캘린더 삭제를 지원합니다. |
| Google Calendar 연동 | 설정 시 Google Calendar의 사무실 일정을 읽어 홈 데이터에 합칩니다. 읽기 전용 일정은 GitHub에 저장하거나 삭제하지 않습니다. |

## 시스템 전체 구조

이 앱은 별도 운영 DB 없이 GitHub JSON 파일을 일정 데이터 원본으로 사용하는 일정판입니다. Next.js/Vercel 서버가 이미지 분석, 직접 입력, 외부 webhook, 수정/삭제 요청을 받아 `data/*.json` 파일을 GitHub Contents API로 갱신하고, `/display`와 홈 화면은 `/api/planner-data`를 통해 병합된 최신 일정을 읽습니다.

```text
사용자/외부 프로그램
  ↓
Next.js 화면 또는 API Route
  ↓
검증·정규화·AI 분석·upsert 처리
  ↓
GitHub data/*.json 커밋 저장
  ↓
/api/planner-data 병합 응답
  ↓
홈 / display 화면 표시
```

| 흐름 | 설명 |
| --- | --- |
| 내부 업로드 | `/submit`에서 이미지나 폼을 보내면 `POST /api/submit`이 분석/정규화 후 GitHub JSON에 저장합니다. |
| 외부 webhook | 외부 프로그램이 `POST /api/webhook/records`로 JSON을 보내면 `external_id` 기준으로 생성 또는 수정합니다. |
| 화면 데이터 | `GET /api/planner-data`가 GitHub 데이터, Google Calendar 읽기 전용 일정, 정리 필터를 합쳐 화면용 JSON을 반환합니다. |
| 디스플레이 갱신 | `/display`는 `/api/planner-data`를 주기적으로 폴링하고, 화면 내부 로테이션은 클라이언트 상태로 처리합니다. |
| 자동 정리 | `/api/cleanup`이 지난 휴가와 지난 주 사무실/제작 일정을 GitHub JSON에서 제거합니다. |
| 수정/삭제 | `PATCH/DELETE /api/records/[id]`가 GitHub JSON의 특정 레코드를 갱신하거나 삭제합니다. |

운영 데이터 파일은 `data/work-schedules.json`, `data/vacations.json`, `data/office-schedules.json`, `data/production-schedules.json`, `data/recordings.json`, `data/casting-schedules.json`입니다. 파일이 갱신될 때마다 GitHub 커밋이 남으므로 변경 이력과 복구 경로가 생깁니다. 현재 예상 사용량인 하루 10건 안팎의 외부 webhook에는 이 방식으로 충분하며, webhook이 수십~수백 건 이상으로 늘어나면 Supabase/PostgreSQL 같은 DB 이전을 검토합니다.

외부 프로그램 연동 상세 규격과 권장 JSON은 [외부 프로그램 연동 및 시스템 개요](docs/external-integration-system-overview.md)를 참고합니다.

## 디스플레이 모드

- 권장 URL: `https://planner-ecru-beta.vercel.app/display`
- 기존 `/?display=1` 접근도 `/display`로 연결됩니다.
- `/display`에서만 `/api/planner-data`를 2분마다 폴링합니다.
- 일반 `/` 화면은 첫 로드와 탭 복귀 시 중심으로 갱신해 Vercel Fluid Active CPU 사용량을 줄입니다.
- 홈 일정판은 브라우저 내부 상태만으로 로테이션합니다.
  - 이번 주 일정: 30초
  - 이번 달 캘린더: 10초
  - 다음 달 일정이 있을 때 다음 달 캘린더: 10초
- 삼성/Tizen 브라우저에서는 상세 팝업이 하나만 열리도록 처리하고, hover 대신 터치/클릭 중심으로 동작합니다.

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Google Gen AI Gemini
- Google Calendar API
- GitHub REST API Contents
- Vercel Blob 선택 사용

## 로컬 실행

```bash
git clone https://github.com/DannyHot93/planner.git
cd planner
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 다음 주소를 엽니다.

- 일반 화면: [http://localhost:3000](http://localhost:3000)
- 디스플레이 화면: [http://localhost:3000/display](http://localhost:3000/display)

## 환경 변수

`.env.example`을 기준으로 `.env.local`을 작성합니다. 실제 키와 토큰은 Git에 커밋하지 않습니다.

| 변수 | 설명 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API 키 |
| `GEMINI_MODEL` | 기본 분석 모델 |
| `GEMINI_FALLBACK_MODEL` | 1차 분석 실패 또는 JSON 오류 시 fallback 모델 |
| `GEMINI_CASTING_MODEL` | 선택. 주조 캐스팅 전용 모델 |
| `GITHUB_TOKEN` | GitHub PAT. `repo` 권한 필요 |
| `GITHUB_OWNER` | GitHub 사용자 또는 조직 |
| `GITHUB_REPO` | 데이터가 저장될 저장소 이름 |
| `GITHUB_BRANCH` | 저장 브랜치. 기본 `main` |
| `WEBHOOK_SECRET` | 외부 JSON webhook 수신 API 보호용 Bearer 토큰 |
| `BLOB_READ_WRITE_TOKEN` | 선택. Vercel Blob 저장소 연결 시 이미지 저장에 사용 |
| `GOOGLE_CALENDAR_SYNC_ENABLED` | 선택. `false`면 Google Calendar 연동 끔 |
| `GOOGLE_CALENDAR_ID` | Google Calendar ID |
| `GOOGLE_CALENDAR_API_KEY` | 공개 캘린더 조회용 API 키 |
| `GOOGLE_CALENDAR_SUBCALENDAR_SUMMARY` | 선택. OAuth/서비스 계정 사용 시 특정 부캘 이름 필터 |
| `GOOGLE_CALENDAR_OAUTH_CLIENT_ID` | OAuth 방식 Calendar 연동용 클라이언트 ID |
| `GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET` | OAuth 방식 Calendar 연동용 클라이언트 Secret |
| `GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN` | OAuth 리프레시 토큰 |
| `GOOGLE_CALENDAR_CLIENT_EMAIL` | 서비스 계정 방식 Calendar 연동용 이메일 |
| `GOOGLE_CALENDAR_PRIVATE_KEY` | 서비스 계정 방식 Calendar 연동용 private key |
| `CRON_SECRET` | cleanup API 보호용 secret |

OAuth 리프레시 토큰 발급은 다음 명령을 사용합니다.

```bash
npm run gcal:oauth
```

## Webhook API

외부 시스템에서 JSON으로 일정을 등록하려면 `POST /api/webhook/records`를 호출합니다. 요청은 `Authorization: Bearer $WEBHOOK_SECRET` 헤더가 필요하며, 저장된 일정은 기존 `/display` 화면에 최대 2분 내 표시됩니다.

```bash
curl -X POST https://planner-ecru-beta.vercel.app/api/webhook/records \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"office-schedule","summary":"테스트 일정","external_id":"external-schedule-uuid","details":{"entries":[{"date":"2026-07-02","time":"14:00"}]}}'
```

`external_id`는 선택 필드입니다. 외부 시스템의 일정 UUID를 `external_id`로 보내면 같은 `type` 데이터 파일 안에서 이미 존재하는 일정은 update, 없으면 insert로 처리합니다. `external_id`가 없으면 기존처럼 매 요청마다 새 일정이 생성됩니다.

허용되는 `type` 값은 `work-schedule`, `vacation`, `office-schedule`, `production-schedule`, `casting-schedule`입니다. 이미지는 webhook에서 받지 않으며, 이미지 등록은 기존 `/submit` 화면을 사용합니다.

## 데이터 파일

| 파일 | 용도 |
| --- | --- |
| `data/work-schedules.json` | 근무표 |
| `data/vacations.json` | 휴가 |
| `data/office-schedules.json` | 사무실 일정 |
| `data/production-schedules.json` | 제작 일정 |
| `data/recordings.json` | 레거시 녹화 일정 |
| `data/casting-schedules.json` | 주조/캐스팅 일정 |

서버는 홈 데이터 요청 시 GitHub 원격 데이터를 우선 읽고, Google Calendar 설정이 있으면 사무실 일정에 읽기 전용 항목을 합칩니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 검증 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 실행 |
| `npm run gcal:oauth` | Google Calendar OAuth refresh token 발급 도우미 |

## 배포

1. Vercel에서 이 GitHub 저장소를 Import합니다.
2. Vercel 프로젝트의 Environment Variables에 `.env.local`과 같은 값을 등록합니다.
3. `main` 브랜치에 푸시하면 Vercel이 자동으로 빌드하고 배포합니다.
4. 디스플레이 모니터는 `/display` 주소를 북마크해서 사용합니다.

## 운영 메모

- `/display` 로테이션은 클라이언트 상태 전환만 사용하므로 추가 API 요청을 만들지 않습니다.
- Vercel Fluid Active CPU 사용량에 직접 영향을 주는 부분은 `/api/planner-data`, 업로드, 수정, 삭제 같은 서버 API 호출입니다.
- 월간 캘린더 상세 팝업은 삼성/Tizen에서 꼬임을 줄이기 위해 디스플레이 모드에서 하나만 열리도록 제한합니다.
- Google Calendar에서 들어온 읽기 전용 일정은 앱에서 삭제/수정하지 않습니다.

## 보안

- `.env.local`과 실제 API 키, GitHub 토큰, Google 토큰은 저장소에 올리지 않습니다.
- 토큰이 노출되면 즉시 폐기하고 새로 발급합니다.
- GitHub PAT는 가능한 한 필요한 저장소와 권한으로만 제한합니다.
