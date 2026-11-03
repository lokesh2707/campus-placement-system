const fs = require("fs");
const path = require("path");
const { renderResumeHtml } = require("./resumeTemplates");

const GENERATED_ROOT = path.join(__dirname, "../uploads/generated-resumes");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Generate a PDF from template + content snapshot into targetPath (absolute).
 * Writes to a temp file first, then renames into place.
 */
const generateResumePdf = async (templateId, snapshot, absoluteFinalPath) => {
  ensureDir(path.dirname(absoluteFinalPath));
  const tempPath = `${absoluteFinalPath}.tmp-${Date.now()}.pdf`;
  const html = renderResumeHtml(templateId, snapshot);

  let browser;
  try {
    // Lazy require so tests can mock and cold starts without puppeteer still load app
    const puppeteer = require("puppeteer");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: tempPath,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size < 100) {
      throw new Error("PDF generation produced an empty file");
    }

    fs.renameSync(tempPath, absoluteFinalPath);

    if (!fs.existsSync(absoluteFinalPath)) {
      throw new Error("PDF finalization failed");
    }

    return absoluteFinalPath;
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      /* ignore cleanup errors */
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
