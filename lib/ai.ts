import OpenAI from "openai";
import { DocumentType, AiAnalysisResult, WorkScheduleKind } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const PROMPTS: Record<DocumentType, string> = {
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

  recording: `이 이미지는 녹화 일정입니다. 이미지에서 녹화 일정 정보를 추출하여 아래 JSON 형식으로 응답하세요.

{
  "summary": "전체 녹화 일정 요약 (한 문장)",
  "details": {
    "period": "기간 (예: 2026-04-07 ~ 2026-04-11)",
    "title": "프로그램/콘텐츠 제목",
    "entries": [
      {
        "date": "날짜 (YYYY-MM-DD)",
        "time": "녹화 시간 (예: 14:00-16:00)",
        "person": "담당자/출연자",
        "note": "특이사항"
      }
    ]
  }
}

이미지에서 읽을 수 없는 필드는 null로 설정하세요. 반드시 유효한 JSON만 응답하세요.`,
};

export async function analyzeWorkScheduleFromText(
  rawText: string,
  kind: WorkScheduleKind
): Promise<AiAnalysisResult> {
  const prompt = buildWorkSchedulePrompt(kind);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n--- 문서에서 추출한 텍스트 ---\n${rawText}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI API에서 응답을 받지 못했습니다.");
  }
  return JSON.parse(content) as AiAnalysisResult;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  documentType: DocumentType,
  options?: { workScheduleKind?: WorkScheduleKind }
): Promise<AiAnalysisResult> {
  let prompt = PROMPTS[documentType];
  if (documentType === "work-schedule" && options?.workScheduleKind) {
    prompt = buildWorkSchedulePrompt(options.workScheduleKind);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI API에서 응답을 받지 못했습니다.");
  }

  const parsed = JSON.parse(content) as AiAnalysisResult;
  return parsed;
}
