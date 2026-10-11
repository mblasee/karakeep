/**
 * Fork-only: on Reddit post pages, fetch the post's `.json` (comment tree
 * included) using the browser's own logged-in session, and attach it to the
 * bookmark as a separate HTML file.
 *
 * Why an attachment instead of the note: Karakeep has no custom fields, and the
 * note is fed into full-text search, embeddings and tagging. A "userUploaded"
 * attachment is stored with the bookmark but not processed by any worker.
 */
import { getPluginSettings } from "../utils/settings";
import { uploadSingleFileAsset } from "../utils/singlefile";

const REDDIT_HOST = /(^|\.)reddit\.com$/i;
const POST_PATH = /\/comments\/([a-z0-9]+)/i;

export function redditJsonUrl(pageUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (!REDDIT_HOST.test(url.hostname) || !POST_PATH.test(url.pathname)) {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, "");
  // raw_json=1: no HTML-entity escaping in bodies; limit=500: max comments.
  return `${url.origin}${path}.json?raw_json=1&limit=500`;
}

/**
 * Runs `fetch` inside the page itself (MAIN world), so it's a same-origin
 * request carrying the user's Reddit cookies. Reddit has refused anonymous
 * `.json` requests since mid-2026, so this only works while logged in.
 */
async function fetchInPage(tabId: number, url: string): Promise<string> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (target: string) => {
      const res = await fetch(target, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return { ok: res.ok, status: res.status, body: await res.text() };
    },
    args: [url],
  });
  const result = injection?.result as
    | { ok: boolean; status: number; body: string }
    | undefined;
  if (!result) {
    throw new Error("Reddit JSON fetch returned nothing");
  }
  if (!result.ok) {
    throw new Error(`Reddit JSON fetch failed with HTTP ${result.status}`);
  }
  return result.body;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One copy of the data, readable when opened and machine-readable via:
 *   JSON.parse(doc.getElementById("reddit-json").textContent)
 */
function wrapJsonInHtml(
  json: string,
  sourceUrl: string,
  title: string,
): string {
  const pretty = JSON.stringify(JSON.parse(json), null, 2);
  return [
    "<!DOCTYPE html>",
    '<html><head><meta charset="utf-8">',
    `<title>Reddit JSON: ${escapeHtml(title)}</title>`,
    `<meta name="karakeep-fork:source-url" content="${escapeHtml(sourceUrl)}">`,
    `<meta name="karakeep-fork:fetched-at" content="${new Date().toISOString()}">`,
    "</head><body>",
    `<pre id="reddit-json">${escapeHtml(pretty)}</pre>`,
    "</body></html>",
  ].join("\n");
}

/** Fetches + uploads. Returns the asset id to attach once the bookmark exists. */
export async function captureRedditJson(
  tabId: number,
  pageUrl: string,
  title: string | undefined,
): Promise<string | null> {
  const jsonUrl = redditJsonUrl(pageUrl);
  if (!jsonUrl) {
    return null;
  }
  const json = await fetchInPage(tabId, jsonUrl);
  const postId = POST_PATH.exec(new URL(pageUrl).pathname)?.[1] ?? "post";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return await uploadSingleFileAsset(
    wrapJsonInHtml(json, pageUrl, title ?? postId),
    `reddit-json-${postId}-${stamp}`,
  );
}

export async function attachAssetToBookmark(
  bookmarkId: string,
  assetId: string,
): Promise<void> {
  const settings = await getPluginSettings();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${settings.apiKey}`,
    "Content-Type": "application/json",
    ...settings.customHeaders,
  };
  const res = await fetch(
    `${settings.address}/api/v1/bookmarks/${encodeURIComponent(bookmarkId)}/assets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ id: assetId, assetType: "userUploaded" }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to attach asset: ${res.status} ${await res.text()}`,
    );
  }
}
