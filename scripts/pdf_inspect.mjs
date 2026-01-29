import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function usage() {
  console.log("Usage: node scripts/pdf_inspect.mjs <pdf-path> [output-dir]");
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) usage();

const resolvedInput = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolvedInput)) {
  console.error(`PDF not found: ${resolvedInput}`);
  process.exit(1);
}

const outputDir = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : path.resolve(__dirname, "../Logs/pdf_extract");

fs.mkdirSync(outputDir, { recursive: true });

const require = createRequire(import.meta.url);
const workerPath = path.resolve(
  path.dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")),
  "pdf.worker.mjs"
);
GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const data = new Uint8Array(fs.readFileSync(resolvedInput));
const doc = await getDocument({ data, disableWorker: true }).promise;

const baseName = path.basename(resolvedInput, path.extname(resolvedInput));
const textOutPath = path.join(outputDir, `${baseName}.txt`);
let fullText = "";

for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;

  const imagePath = path.join(outputDir, `${baseName}-page-${pageNum}.png`);
  fs.writeFileSync(imagePath, canvas.toBuffer("image/png"));

  const textContent = await page.getTextContent();
  const pageText = textContent.items.map((item) => item.str).join(" ");
  fullText += `\n\n=== Page ${pageNum} ===\n${pageText}`;
}

fs.writeFileSync(textOutPath, fullText.trim() + "\n", "utf8");
console.log(`Done. Extracted ${doc.numPages} pages.`);
console.log(`Images: ${outputDir}`);
console.log(`Text: ${textOutPath}`);
