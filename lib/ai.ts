import { DocumentType, AiAnalysisResult, WorkScheduleKind, CastingEntry } from "./types";

function requireGeminiKey(): string {
  const k = process.env.GEMINI_API_KEY?.trim();
  if (!k) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경 변수를 확인하세요."
    );
  }
  return k;
}

function primaryModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function fallbackModel(): string {
  const fb = process.env.GEMINI_FALLBACK_MODEL?.trim();
  if (fb && fb !== primaryModel()) return fb;
  return "gemini-2.5-flash";
}

function castingPrimaryModel(): string {
  return process.env.GEMINI_CASTING_MODEL?.trim() || primaryModel();
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { message?: string; status?: string };
}

async function callGeminiApi(
  apiKey: string,
  model: string,
  parts: GeminiPart[]
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Gemini API 오류 (${model}) ${res.status}: ${errText.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.error?.message) {
    throw new Error(`Gemini API 오류: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const finishReason = data.candidates?.[0]?.finishReason;

  if (!text) {
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "AI 응답이 길이 제한으로 잘렸습니다. 이미지를 더 가깝게 찍거나 일부만 올린 뒤 다시 시도해 주세요."
      );
    }
    throw new Error("AI API에서 응답이 비어 있습니다.");
  }

  return text;
}

/**
 * 1) primary 모델 시도
 * 2) 예외 또는 JSON 파싱 실패 시 fallback 모델 한 번 더
 */
async function generateJsonWithFallback(
  parts: GeminiPart[],
  primary: string
): Promise<string> {
  const apiKey = requireGeminiKey();
  const secondary = fallbackModel();
  const models = primary === secondary ? [primary] : [primary, secondary];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const text = await callGeminiApi(apiKey, model, parts);
      JSON.parse(text);
      return text;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  const msg = lastError?.message ?? "AI API에서 응답을 받지 못했습니다.";
  const isJson =
    lastError instanceof SyntaxError ||
    (lastError?.name === "SyntaxError") ||
    msg.toLowerCase().includes("json");
  throw new Error(
    isJson
      ? "AI 응답을 JSON으로 읽을 수 없습니다. 잠시 후 다시 시도해 주세요."
      : msg
  );
}

const OFFICE_WORK_PROMPT = `이 자료는 사무실 근무표입니다. 표에서 근무 일정 정보를 추출하여 아래 JSON 형식으로만 응답하세요.

{
  "summary": "전체 근무표 요약 (한 문장)",
  "details": {
    "period": "기간 (예: 2026-04-07 ~ 2026-04-11)",
    "entries": [
      {
        "date": "날짜 (YYYY-MM-DD)",
        "person": "담당자 이름",
        "time": "근무 시간 (예: 09:00-18:00)",
        "note": "특이사항"
      }
    ]
  }
}

읽을 수 없는 필드는 null로 설정하세요. 반드시 유효한 JSON만 응답하세요.`;

const PRODUCTION_WORK_PROMPT = `이 자료는 제작(방송) 근무표입니다. 표에서 근무 일정 정보를 추출하여 아래 JSON 형식으로만 응답하세요.

중요: 문서에 표기된 근무 구분 문자 **D는 오전 근무**, **N은 오후 근무**입니다. 각 일정에 해당하면 entries에 반드시 shift 필드를 넣으세요.
- "D" → 오전 근무
- "N" → 오후 근무
- D/N이 없는 경우 shift는 null

{
  "summary": "전체 근무표 요약 (한 문장)",
  "details": {
    "period": "기간 (예: 2026-04-07 ~ 2026-04-11)",
    "entries": [
      {
        "date": "날짜 (YYYY-MM-DD)",
        "person": "담당자 이름",
        "time": "근무 시간 또는 시간대",
        "shift": "D 또는 N 또는 null",
        "note": "특이사항"
      }
    ]
  }
}

읽을 수 없는 필드는 null로 설정하세요. 반드시 유효한 JSON만 응답하세요.`;

export function buildWorkSchedulePrompt(kind: WorkScheduleKind): string {
  return kind === "production" ? PRODUCTION_WORK_PROMPT : OFFICE_WORK_PROMPT;
}

const PROMPTS: Record<Exclude<DocumentType, "casting-schedule">, string> = {
  "work-schedule": OFFICE_WORK_PROMPT,

  vacation: `이 이미지는 휴가 일정입니다. 이미지에서 휴가 정보를 추출하여 아래 JSON 형식으로 응답하세요.

{
  "summary": "전체 휴가 일정 요약 (한 문장)",
  "details": {
    "period": "기간 (예: 2026-04-07 ~ 2026-04-11)",
    "entries": [
      {
        "date": "날짜 (YYYY-MM-DD)",
        "person": "휴가자 이름",
        "reason": "휴가 사유",
        "note": "특이사항"
      }
    ]
  }
}

이미지에서 읽을 수 없는 필드는 null로 설정하세요. 반드시 유효한 JSON만 응답하세요.`,

  "office-schedule": `이 이미지는 사무실 녹화·방송·촬영·회의 등 **일정표**입니다. 표·글상자·수기 메모의 맥락을 읽고, **실제 일어나는 날짜·시각**을 구조화하세요.

필수 규칙:
- 각 일정 행마다 **반드시** entries에 한 항목씩 넣습니다. 여러 날짜가 있으면 행을 나눕니다.
- **date**는 반드시 "YYYY-MM-DD" 문자열입니다. 한국어(예: 5월 6일, 5/6)로만 적혀 있으면, 문서 상단·표 제목의 **연·월** 또는 period에 나온 연도를 써서 YYYY-MM-DD로 환산합니다. 연도가 없으면 표 기간·상단 날짜의 연도를 사용합니다.
- **time**에는 녹화·방송·회의 **시작~종료** 또는 한 줄로 읽히는 시각을 넣습니다 (예: "10:30-11:40", "오전 9시 50분~11시").
- **place**는 스튜디오·층·룸명 등이 있으면 넣습니다.
- **period**에는 문서에 보이는 **표 전체 기간** 또는 주차를 "YYYY-MM-DD ~ YYYY-MM-DD" 형태로 쓸 수 있으면 그렇게 씁니다.
- **title**에는 대표 프로그램명·행사명이 있으면 넣습니다.
- 표에서 **같은 날짜가 위 행에만** 있고 아래는 시간만 다른 경우, 아래 행에도 **같은 date**를 반복해 넣습니다 (날짜 칸이 비어 있어도 위 행 날짜를 복사).

{
  "summary": "전체 요약 (한 문장)",
  "details": {
    "period": "문서/표에서 읽은 기간 또는 null",
    "title": "대표 제목 또는 null",
    "entries": [
      {
        "date": "YYYY-MM-DD",
        "time": "시간대 또는 null",
        "place": "장소 또는 null",
        "person": "담당 또는 null",
        "note": "특이사항 또는 null"
      }
    ]
  }
}

읽을 수 없는 필드만 null로 두고, **date는 가능한 한 항상 채웁니다.** 반드시 유효한 JSON만 응답하세요.`,

  "production-schedule": `이 이미지는 **제작(방송) 일정표**입니다. 녹화일·방송일·촬영일·송출 등이 적힌 열·칸의 **맥락**을 파악해 날짜와 시각을 구조화하세요.

필수 규칙:
- 각 일정(프로그램·코너·행 한 줄)마다 entries에 **한 항목**씩 넣습니다.
- **date**는 반드시 "YYYY-MM-DD". 문서에 "4/30(수)", "5월 6일" 등만 있으면 period·상단 기간·표 제목의 연도를 참고해 완전한 YYYY-MM-DD로 만듭니다.
- **time**에는 녹화·방송·제작 시간을 넣습니다 (예: "09:50-11:00", "14:00–16:00").
- **place**는 스튜디오·뉴스룸·층 등.
- **period**는 표가 덮는 기간을 "YYYY-MM-DD ~ YYYY-MM-DD"로 쓸 수 있으면 작성.
- **title**은 프로그램·콘텐츠 제목.
- 같은 날짜가 첫 행에만 적혀 있고 이어지는 행에는 날짜가 비어 있으면, **동일 date**를 각 행에 반복합니다.

{
  "summary": "전체 제작 일정 요약 (한 문장)",
  "details": {
    "period": "기간 또는 null",
    "title": "프로그램/콘텐츠 제목 또는 null",
    "entries": [
      {
        "date": "YYYY-MM-DD",
        "time": "제작·녹화 시간 또는 null",
        "place": "스튜디오·장소 또는 null",
        "person": "담당·출연 또는 null",
        "note": "특이사항 또는 null"
      }
    ]
  }
}

**date를 가능한 한 모든 행에 채웁니다.** 반드시 유효한 JSON만 응답하세요.`,
};

const CASTING_SCHEDULE_PROMPT = `이 이미지는 주조 근무표입니다. 이미지 하단에 있는 휴가 관련 표(휴가자, 휴가일, 대근자(주간), 대근자(야간) 컬럼이 포함된 테이블)만 찾아서 정보를 추출하세요.

추출 규칙:
- "휴가자" 또는 "성명" 컬럼: person 필드
- "휴가일" 또는 "날짜" 컬럼: date 필드 (YYYY-MM-DD 형식으로 변환)
  - 숫자만 있는 경우(예: 7, 14, 21) → 그 달의 '일자'로 해석 (예: 근무표 기간이 4월이면 "2026-04-07")
  - 연도가 없으면 근무표 상단 기간(period)의 연월을 기준으로 보완
- "대근자(주간)" 또는 "주간대근" 컬럼: dayReplacer 필드
- "대근자(야간)" 또는 "야간대근" 컬럼: nightReplacer 필드
- 해당 셀이 비어있으면 null

아래 JSON 형식으로만 응답하세요:

{
  "summary": "주조 근무표 요약 (기간 포함, 한 문장)",
  "details": {
    "period": "근무표 전체 기간 (예: 2026-04-07 ~ 2026-04-11, 상단에서 찾을 것)",
    "entries": [
      {
        "person": "휴가자 이름",
        "date": "휴가 날짜 (YYYY-MM-DD)",
        "dayReplacer": "대근자(주간) 이름 또는 null",
        "nightReplacer": "대근자(야간) 이름 또는 null",
        "note": "특이사항 또는 null"
      }
    ]
  }
}

하단 휴가 테이블이 없거나 비어있으면 entries를 빈 배열로 반환하세요. 반드시 유효한 JSON만 응답하세요.`;

export interface CastingAiResult {
  summary: string;
  details: {
    period?: string;
    entries: CastingEntry[];
  };
}

export async function analyzeCastingScheduleImage(
  imageBase64: string,
  mimeType: string
): Promise<CastingAiResult> {
  const parts: GeminiPart[] = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: CASTING_SCHEDULE_PROMPT },
  ];
  const content = await generateJsonWithFallback(parts, castingPrimaryModel());
  try {
    return JSON.parse(content) as CastingAiResult;
  } catch {
    throw new Error(
      "AI 응답을 JSON으로 읽을 수 없습니다. 잠시 후 다시 시도해 주세요."
    );
  }
}

/** 엑셀에서 추출한 표 텍스트로 휴가 일정 분석 */
export async function analyzeVacationFromText(
  rawText: string
): Promise<AiAnalysisResult> {
  const base = PROMPTS.vacation.replace(
    "이 이미지는 휴가 일정입니다. 이미지에서 휴가 정보를 추출하여",
    "아래는 엑셀(표)에서 추출한 텍스트입니다. 열 이름과 행을 맥락으로 이해하고 휴가 정보를 추출하여"
  );
  const content = await generateJsonWithFallback(
    [{ text: `${base}\n\n--- 문서에서 추출한 텍스트 ---\n${rawText}` }],
    primaryModel()
  );
  try {
    return JSON.parse(content) as AiAnalysisResult;
  } catch {
    throw new Error(
      "AI 응답을 JSON으로 읽을 수 없습니다. 잠시 후 다시 시도해 주세요."
    );
  }
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  documentType: Exclude<DocumentType, "casting-schedule">,
  options?: { workScheduleKind?: WorkScheduleKind }
): Promise<AiAnalysisResult> {
  let prompt = PROMPTS[documentType];
  if (documentType === "work-schedule" && options?.workScheduleKind) {
    prompt = buildWorkSchedulePrompt(options.workScheduleKind);
  }

  const parts: GeminiPart[] = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: prompt },
  ];
  const content = await generateJsonWithFallback(parts, primaryModel());
  try {
    return JSON.parse(content) as AiAnalysisResult;
  } catch {
    throw new Error(
      "AI 응답을 JSON으로 읽을 수 없습니다. 잠시 후 다시 시도해 주세요."
    );
  }
}
