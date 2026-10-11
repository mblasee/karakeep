/**
 * Fork-only: injects SingleFile's page-world hooks so lazy-loaded images can
 * actually be triggered before the capture.
 */
// Emitted as a plain file into the extension bundle; injected into the page's
// MAIN world on demand (it's a self-contained IIFE, no imports).
import hooksScriptUrl from "single-file-core/processors/hooks/content/content-hooks-frames-web.js?url";

/**
 * The lazy-image loader talks to hooks running in the page's own JS world
 * (they fake a huge viewport, force `loading=lazy` images to eager, etc.).
 * Inject them once per page before capturing.
 */
export async function injectSingleFileHooks(tabId: number): Promise<void> {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const g = globalThis as unknown as { __karakeepForkSfHooks__?: boolean };
      const alreadyInjected = g.__karakeepForkSfHooks__ === true;
      g.__karakeepForkSfHooks__ = true;
      return alreadyInjected;
    },
  });
  if (probe?.result === true) {
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: [hooksScriptUrl.replace(/^\//, "")],
  });
}
