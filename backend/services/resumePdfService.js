const fs = require("fs");
const path = require("path");

/** Kept for reading legacy disk-stored resumes only */
const GENERATED_ROOT = path.join(__dirname, "../uploads/generated-resumes");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/** System Chrome/Edge paths when Puppeteer's bundled Chrome is missing */
const candidateChromePaths = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return [process.env.PUPPETEER_EXECUTABLE_PATH];
  }

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    return [
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(local, "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
  }

  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
};

const resolveSystemBrowser = () => {
  for (const candidate of candidateChromePaths()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const chromeMissingError = () => {
  const err = new Error(
    "Resume PDF needs Chrome. From the backend folder run: npx puppeteer browsers install chrome"
  );
  err.statusCode = 503;
  return err;
};

const launchBrowser = async (puppeteer) => {
  const common = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };

  try {
    return await puppeteer.launch(common);
  } catch (bundledErr) {
    const executablePath = resolveSystemBrowser();
    if (!executablePath) {
      throw chromeMissingError();
    }
    try {
      return await puppeteer.launch({ ...common, executablePath });
    } catch {
      throw chromeMissingError();
    }
  }
};

/**
 * Generate a PDF from template + content snapshot.
 * Returns a Buffer (stored in MongoDB) — does not write to disk.
 */
const generateResumePdf = async (templateId, snapshot) => {
  const { renderResumeHtml } = require("./resumeTemplates");
  const html = renderResumeHtml(templateId, snapshot);

  let browser;
  try {
    const puppeteer = require("puppeteer");
    browser = await launchBrowser(puppeteer);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const rawPdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "8mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    const pdfBuffer = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      throw new Error("PDF generation produced an empty file");
    }

    return pdfBuffer;
  } catch (error) {
    if (
      !error.statusCode &&
      /Could not find Chrome|Failed to launch the browser/i.test(String(error.message || ""))
    ) {
      throw chromeMissingError();
    }
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
};

const studentDir = (studentId) => {
  const safeId = String(studentId).replace(/[^a-fA-F0-9]/g, "");
  return path.join(GENERATED_ROOT, safeId || "unknown");
};

/** Resolve legacy on-disk resume path (pre-DB storage). */
const resolveSafeFilePath = (studentId, fileName) => {
  const base = path.basename(String(fileName || ""));
  if (!base || base !== fileName || !base.toLowerCase().endsWith(".pdf")) {
    throw new Error("Invalid resume file name");
  }
  const full = path.join(studentDir(studentId), base);
  const root = path.resolve(studentDir(studentId));
  if (!path.resolve(full).startsWith(root)) {
    throw new Error("Invalid resume path");
  }
  return full;
};

module.exports = {
  GENERATED_ROOT,
  ensureDir,
  generateResumePdf,
  studentDir,
  resolveSafeFilePath,
};
