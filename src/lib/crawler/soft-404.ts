import * as cheerio from "cheerio";

export const SOFT_404_PHRASES = [
  "page not found",
  "404",
  "doesn't exist",
  "does not exist",
  "no longer available",
  "cannot find this page",
  "couldn't find this page",
  "page is unavailable",
  "nothing here",
];

export interface Soft404CheckResult {
  isSoft404: boolean;
  reason?: string;
  bodyLength: number;
}

export function detectSoft404(html: string): Soft404CheckResult {
  if (!html || !html.trim()) {
    return { isSoft404: true, reason: "Empty HTML content", bodyLength: 0 };
  }

  const $ = cheerio.load(html);
  const title = $("title").text().toLowerCase();
  const h1 = $("h1").text().toLowerCase();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const bodyTextLower = bodyText.toLowerCase();
  const bodyLength = bodyText.length;

  // The page is a soft 404 if title or body contains error phrases and body text is under 1500 chars
  if (bodyLength < 1500) {
    for (const phrase of SOFT_404_PHRASES) {
      if (
        title.includes(phrase) ||
        h1.includes(phrase) ||
        bodyTextLower.includes(phrase)
      ) {
        return {
          isSoft404: true,
          reason: `Soft 404 detected: found "${phrase}" with text length ${bodyLength} (<1500 chars)`,
          bodyLength,
        };
      }
    }
  }

  return { isSoft404: false, bodyLength };
}
