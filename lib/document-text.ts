import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const MAX_CHARS = 120_000;

function configurePdfWorker(GlobalWorkerOptions: { workerSrc: string }): void {
  const local = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/build/pdf.worker.mjs"
  );
  if (fs.existsSync(local)) {
    GlobalWorkerOptions.workerSrc = pathToFileURL(local).href;
    return;
  }
  try {
    const pkgPath = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/package.json"
    );
    const v = (JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string })
      .version;
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.mjs`;
  } catch {
    GlobalWorkerOptions.workerSrc =
      "https://unpkg.com/pdfjs-dist@5.6.205/build/pdf.worker.mjs";
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { getDocument, GlobalWorkerOptions } = pdfjs;

  configurePdfWorker(GlobalWorkerOptions);

  const uint8Array = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data: uint8Array,
    useSystemFonts: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const parts = content.items.map((item) =>
      item && typeof item === "object" && "str" in item
        ? String((item as { str: string }).str)
        : ""
    );
    fullText += parts.join(" ") + "\n";
  }
  const text = fullText.trim();
  if (!text) {
    throw new Error(
      "PDF에서 텍스트를 읽지 못했습니다. 스캔 PDF는 이미지로 저장한 뒤 올려 주세요."
    );
  }
  return text.slice(0, MAX_CHARS);
}

export async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (!text) {
    throw new Error("워드 문서에서 텍스트를 읽지 못했습니다.");
  }
  return text.slice(0, MAX_CHARS);
}
