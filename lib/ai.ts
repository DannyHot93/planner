import OpenAI from "openai";
import { DocumentType, AiAnalysisResult } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPTS: Record<DocumentType, string> = {
  "work-schedule": `이 이미지는 근무표입니다. 이미지에서 근무 일정 정보를 추출하여 아래 JSON 형식으로 응답하세요.

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

이미지에서 읽을 수 없는 필드는 null로 설정하세요. 반드시 유효한 JSON만 응답하세요.`,

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

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  documentType: DocumentType
): Promise<AiAnalysisResult> {
  const prompt = PROMPTS[documentType];

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
