import { sanitize } from "#utils/sanitize.js";

/**
 * Process Wikipedia from Cheerio readout
 * @param {import('cheerio').CheerioAPI} $
 * @returns {{ type: 'text' | 'error', content: String}}
 */
export function wikipedia($) {
  const paragraphs = $(
    ".mw-body-content .mw-parser-output p",
    ".mw-body"
  )
    .map((_, el) => $(el).html())
    .toArray()
    .slice(0, 3)
    .join("\n");

  if (paragraphs) {
    return {
      type: "text",
      content: sanitize(paragraphs)
        .replace(/\[(\d+|update)\]/g, "")
        .replace(/\r\n/g, "\n")
        .trim() + "\n"
    };
  }

  return {
    type: "error",
    content: ""
  };
}
