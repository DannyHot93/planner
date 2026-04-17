# 일정 플래너 (Planner)

근무·휴가·사무실·제작 일정을 **이미지 업로드** 또는 **폼 입력**으로 등록하면, 서버에서 OpenAI Vision으로 분석하고 결과를 JSON으로 만든 뒤 **GitHub 저장소**에 커밋합니다. [Vercel](https://vercel.com)에 연결해 두면 `main` 푸시 시 자동 배포되고, 공개 홈에서 최신 일정을 볼 수 있습니다.

## 주요 기능

| 구분 | 설명 |
|------|------|
| **홈 `/`** | 상단 탭: **일정**(대시보드) · **근무표** · **휴가** · **사무실일정** · **제작일정** |
| **일정 탭** | 이번 주 / 이번 주 외 사무실·제작 일정 요약, 우측에 휴가(오늘의 휴가·부서별) |
| **업로드 `/submit`** | 문서 종류 선택, 이미지·메모·폼 입력 → AI 분석 후 GitHub에 저장 |
| **데이터** | 서버가 `data/*.json`을 읽고(GitHub 연동 시 원격 우선), 업로드 시 Contents API로 커밋 |

## 기술 스택

- Next.js 16 (App Router), React 19, TypeScript  
- Tailwind CSS 4  
- OpenAI API (`gpt-4o` 등, Vision + 구조화 응답)  
- GitHub REST API (Contents: 읽기·쓰기·커밋)

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

1. `.env.example`을 복사해 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

2. `.env.local`에 값을 채웁니다.

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GITHUB_TOKEN` | GitHub PAT (`repo` 권한) |
| `GITHUB_OWNER` | GitHub 사용자 또는 조직 이름 |
| `GITHUB_REPO` | 저장소 이름 |
| `GITHUB_BRANCH` | 커밋할 브랜치 (기본 `main`) |

3. 개발 서버

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint |

## 데이터 파일 (`data/`)

| 파일 | 용도 |
|------|------|
| `work-schedules.json` | 근무표 |
| `vacations.json` | 휴가 |
| `office-schedules.json` | 사무실 일정 |
| `production-schedules.json` | 제작 일정 |
| `recordings.json` | 구 녹화 일정(레거시) |
| `casting-schedules.json` | 주조 근무 |

각 파일은 JSON 배열이며, 새 항목은 앞쪽에 추가됩니다.

## Vercel 배포

1. [Vercel](https://vercel.com)에서 이 GitHub 저장소를 Import합니다.  
2. **Settings → Environment Variables**에 `.env.local`과 동일한 변수를 등록합니다. (키는 Vercel에만 두고 저장소에 커밋하지 않습니다.)  
3. `main`에 푸시하면 프로덕션 빌드·배포가 실행됩니다.  
4. 업로드로 GitHub의 `data/*.json`이 바뀌면, 다음 배포 또는 재배포 시 반영됩니다.

CLI로 수동 배포할 때(로그인·링크된 프로젝트가 있을 때):

```bash
npx vercel deploy --prod
```

## 보안

- `.env.local`은 `.gitignore`에 포함되어 Git에 올라가지 않습니다.  
- API 키·토큰은 이슈·채팅에 붙이지 마세요. 노출 시 즉시 폐기 후 재발급하세요.

## 라이선스

Private 저장소라면 팀 내부 용도로 사용합니다. 공개 시 원하는 라이선스를 추가하세요.
