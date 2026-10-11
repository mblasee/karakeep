/**
 * Content script for capturing page content using SingleFile
 */

import { getPageData, init } from "single-file-core/single-file.js";

import type { CaptureOptions } from "../fork/captureOptions";
import { buildSingleFileOptions } from "../fork/captureOptions";
import { extensionFetch } from "../fork/captureBridge";
import { DEFAULT_FORK_SETTINGS } from "../fork/settings";

declare global {
  interface Window {
    __karakeepSingleFileLoaded__?: boolean;
  }
}

if (window.__karakeepSingleFileLoaded__) {
  // Already registered in this page context — don't re-register listeners.
  // Using `throw` short-circuits re-injection cleanly.
  throw new Error("karakeep singlefile content script already loaded");
}
window.__karakeepSingleFileLoaded__ = true;

// Fork: download resources through the extension (no page CORS limits).
init({ fetch: extensionFetch, frameFetch: extensionFetch });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_PAGE") {
    captureCurrentPage({
      blockImages: message.blockImages === true,
      capture: message.capture ?? DEFAULT_FORK_SETTINGS,
    })
      .then((html) => sendResponse({ success: true, html }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

async function captureCurrentPage(opts: {
  blockImages: boolean;
  capture: CaptureOptions;
}): Promise<string> {
  const pageData = await getPageData(
    buildSingleFileOptions(opts.capture, opts.blockImages),
    {},
    document,
    window,
  );
  return opts.blockImages
    ? restoreOriginalImageUrls(pageData.content)
    : pageData.content;
}

function restoreOriginalImageUrls(html: string): string {
  // Move `data-sf-original-src` / `data-sf-original-srcset` back onto the
  // element as `src` / `srcset` so images load from origin in the viewer.
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const attr of ["src", "srcset"] as const) {
    const dataAttr = `data-sf-original-${attr}`;
    doc.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
      const v = el.getAttribute(dataAttr);
      if (v) el.setAttribute(attr, v);
      el.removeAttribute(dataAttr);
    });
  }
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
