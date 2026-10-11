/**
 * Fork-only: lets SingleFile download page resources (images, fonts, CSS)
 * through the extension instead of from inside the page.
 *
 * Without this, SingleFile's requests run with the page's CORS rules, so
 * cross-origin images (e.g. i.redd.it / preview.redd.it on reddit.com) come
 * back empty and show up as blank boxes in the saved archive. Extension pages
 * with the `<all_urls>` host permission aren't bound by CORS.
 *
 * The popup is guaranteed to be alive while it awaits a capture, so it serves
 * the requests (the background isn't reliably reachable on Firefox Android).
 * It also answers SingleFile's lazy-loading timer messages (see below).
 */

const MESSAGE_TYPE = "KARAKEEP_FORK_FETCH";

interface FetchRequest {
  type: typeof MESSAGE_TYPE;
  url: string;
  accept?: string;
}

interface FetchReply {
  ok: boolean;
  status?: number;
  url?: string;
  contentType?: string;
  bodyBase64?: string;
  error?: string;
}

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Extension side (popup)
// ---------------------------------------------------------------------------

async function serve(req: FetchRequest): Promise<FetchReply> {
  try {
    const res = await fetch(req.url, {
      headers: req.accept ? { accept: req.accept } : undefined,
      credentials: "include",
      cache: "force-cache",
    });
    return {
      ok: true,
      status: res.status,
      url: res.url,
      contentType: res.headers.get("content-type") ?? undefined,
      bodyBase64: toBase64(await res.arrayBuffer()),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * SingleFile's lazy-image loader, when a `browser` global exists (Firefox),
 * asks the extension to run its timers and expects a
 * "singlefile.lazyTimeout.onTimeout" message back. Without an answer the
 * capture stalls until the capture timeout.
 */
interface LazyTimeoutMessage {
  method:
    | "singlefile.lazyTimeout.setTimeout"
    | "singlefile.lazyTimeout.clearTimeout";
  type: string;
  delay?: number;
}

function isLazyTimeoutMessage(m: unknown): m is LazyTimeoutMessage {
  const method = (m as Partial<LazyTimeoutMessage> | undefined)?.method;
  return (
    method === "singlefile.lazyTimeout.setTimeout" ||
    method === "singlefile.lazyTimeout.clearTimeout"
  );
}

/**
 * Starts answering the content script's requests during a capture. Returns a
 * function that stops it.
 */
export function startCaptureBridge(): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const onMessage = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (reply: unknown) => void,
  ): boolean | undefined => {
    if (isLazyTimeoutMessage(message)) {
      const tabId = sender.tab?.id;
      const key = `${tabId}:${sender.frameId ?? 0}:${message.type}`;
      clearTimeout(timers.get(key));
      timers.delete(key);
      if (
        message.method === "singlefile.lazyTimeout.setTimeout" &&
        tabId !== undefined
      ) {
        timers.set(
          key,
          setTimeout(() => {
            timers.delete(key);
            chrome.tabs
              .sendMessage(
                tabId,
                {
                  method: "singlefile.lazyTimeout.onTimeout",
                  type: message.type,
                },
                { frameId: sender.frameId ?? 0 },
              )
              .catch(() => undefined);
          }, message.delay ?? 0),
        );
      }
      sendResponse({});
      return undefined;
    }
    const req = message as Partial<FetchRequest> | undefined;
    if (req?.type === MESSAGE_TYPE && typeof req.url === "string") {
      serve(req as FetchRequest).then(sendResponse);
      return true; // async response
    }
    return undefined;
  };

  chrome.runtime.onMessage.addListener(onMessage);
  return () => {
    chrome.runtime.onMessage.removeListener(onMessage);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };
}

/** Run `fn` (a capture) with the bridge active. */
export async function withCaptureBridge<T>(fn: () => Promise<T>): Promise<T> {
  const stop = startCaptureBridge();
  try {
    return await fn();
  } finally {
    stop();
  }
}

// ---------------------------------------------------------------------------
// Content-script side (passed to SingleFile's `init({ fetch })`)
// ---------------------------------------------------------------------------

interface SingleFileFetchOptions {
  headers?: { accept?: string };
  referrer?: string;
}

/** Falls back to SingleFile's own in-page fetch if the extension can't help. */
function pageFetch(url: string, options: SingleFileFetchOptions) {
  return fetch(url, {
    headers: options.headers,
    referrer: options.referrer,
    cache: "force-cache",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
}

export async function extensionFetch(
  url: string,
  options: SingleFileFetchOptions = {},
): Promise<Response> {
  let reply: FetchReply | undefined;
  try {
    reply = await chrome.runtime.sendMessage<FetchRequest, FetchReply>({
      type: MESSAGE_TYPE,
      url,
      accept: options.headers?.accept,
    });
  } catch {
    reply = undefined;
  }
  // `new Response()` only accepts 200-599; anything else goes the old way.
  if (
    !reply?.ok ||
    reply.status === undefined ||
    reply.status < 200 ||
    reply.status > 599
  ) {
    return pageFetch(url, options);
  }
  const status = reply.status;
  const response = new Response(
    NULL_BODY_STATUSES.has(status) ? null : fromBase64(reply.bodyBase64 ?? ""),
    {
      status,
      headers: reply.contentType ? { "content-type": reply.contentType } : {},
    },
  );
  // `Response.url` can't be set via the constructor; SingleFile reads it to
  // resolve redirects.
  Object.defineProperty(response, "url", { value: reply.url ?? url });
  return response;
}
