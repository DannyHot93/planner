# 일정 플래너 (Planner)

외부 사용자가 **근무표**, **휴가**, **녹화일정** 이미지를 업로드하면 OpenAI GPT-4o Vision으로 분석하고, 결과를 JSON으로 저장한 뒤 GitHub에 반영합니다. GitHub와 연동된 Vercel이 자동 배포하면 공개 페이지에 최신 일정이 표시됩니다.

## 기능

- `/submit` — 문서 종류 선택, 이미지 1장 업로드, 선택 메모 입력
- `/` — 최신 일정 요약 및 종류별(전체·근무표·휴가·녹화일정) 목록
- 서버에서 OpenAI 멀티모달 API 호출 → JSON 검증·정규화 → GitHub Contents API로 커밋

## 기술 스택

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- OpenAI API (`gpt-4o`, Vision + JSON 응답)
- GitHub REST API (Contents: 파일 읽기·커밋)

## 사전 요구 사항

- Node.js 20 이상 권장
- [OpenAI API 키](https://platform.openai.com/)
- GitHub 저장소 및 [Personal Access Token (classic)](https://github.com/settings/tokens) — `repo` 권한

## 로컬 실행

```bash
git clone https://github.com/DannyHot93/planner.git
cd planner
npm install
```

1. 프로젝트 루트에 `.env.local` 파일을 만듭니다. (`.env.example`을 참고)

```bash
cp .env.example .env.local
```

2. `.env.local`에 실제 값을 채웁니다.

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GITHUB_TOKEN` | GitHub PAT (`repo` 권한) |
| `GITHUB_OWNER` | GitHub 사용자 또는 조직 이름 |
| `GITHUB_REPO` | 저장소 이름 |
| `GITHUB_BRANCH` | 커밋할 브랜치 (기본 `main`) |

3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) (또는 터미널에 표시된 포트)로 접속합니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint |

## 데이터 구조

- `data/work-schedules.json` — 근무표
- `data/vacations.json` — 휴가
- `data/recordings.json` — 녹화일정

각 파일은 JSON 배열이며, 업로드 시 새 항목이 앞쪽에 추가됩니다.

## Vercel 배포

1. 이 저장소를 Vercel에 연결합니다.
2. **Environment Variables**에 `.env.local`과 동일한 변수를 등록합니다. (Vercel 대시보드에만 키를 넣고, 저장소에는 커밋하지 않습니다.)
3. `main` 브랜치에 푸시하면 자동 배포됩니다. 업로드 후 GitHub에 커밋이 생기면 다음 배포에서 최신 `data/*.json`이 반영됩니다.

## 보안

- `.env.local`은 `.gitignore`에 포함되어 Git에 올라가지 않습니다.
- API 키·토큰·시크릿은 채팅이나 이슈에 붙여 넣지 마세요. 노출 시 즉시 키를 폐기하고 새로 발급하세요.

## 라이선스

Private 프로젝트로 설정되어 있으면 본인만 사용합니다. 필요 시 별도 라이선스를 추가하세요.
