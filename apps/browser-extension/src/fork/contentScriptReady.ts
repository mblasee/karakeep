/**
 * Fork-only: the SingleFile content script is injected through crxjs' loader,
 * which starts an async import and returns immediately. The upstream code then
 * sends CAPTURE_PAGE before the real script has registered its listener, gets
 * "Receiving end does not exist", and silently falls back to a server crawl
 * (which Reddit answers with a captcha page). The content script now announces
 * itself, and the popup waits for that announcement before capturing.
 */

export const CONTENT_SCRIPT_READY = "KARAKEEP_FORK_SINGLEFILE_READY";

/** Content-script side: call once the CAPTURE_PAGE listener is registered. */
export function announceContentScriptReady(): void {
  chrome.runtime
    .sendMessage({ type: CONTENT_SCRIPT_READY })
    .catch(() => undefined);
}

/**
 * Popup side: start listening BEFORE injecting, so the announcement can't be
 * missed. `ready` resolves when the tab announces itself; the timer only
 * bounds a script that never arrives.
 */
export function expectContentScriptReady(
  tabId: number,
  timeoutMs: number,
): { ready: Promise<void>; cancel: () => void } {
  let cleanup = () => undefined as void;
  const ready = new Promise<void>((resolve, reject) => {
    const listener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ): undefined => {
      if (
        (message as { type?: string } | undefined)?.type ===
          CONTENT_SCRIPT_READY &&
        sender.tab?.id === tabId
      ) {
        cleanup();
        resolve();
      }
      return undefined;
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `SingleFile content script did not start within ${timeoutMs / 1000}s`,
        ),
      );
    }, timeoutMs);
    cleanup = () => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
    };
    chrome.runtime.onMessage.addListener(listener);
  });
  return { ready, cancel: () => cleanup() };
}
