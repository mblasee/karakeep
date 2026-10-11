/**
 * Fork-only: turns the fork settings into SingleFile options. Shared by the
 * popup (which sends them) and the content script (which applies them).
 */
import type { SingleFileOptions } from "single-file-core/single-file.js";

import type { ForkSettings } from "./settings";

/** The serialisable part of the settings the content script needs. */
export type CaptureOptions = Omit<ForkSettings, "redditJsonAttachment">;

type ExtendedSingleFileOptions = SingleFileOptions & {
  loadDeferredImages?: boolean;
  loadDeferredImagesMaxIdleTime?: number;
  loadDeferredImagesDispatchScrollEvent?: boolean;
  passReferrerOnError?: boolean;
};

export function toCaptureOptions(fork: ForkSettings): CaptureOptions {
  const { redditJsonAttachment: _unused, ...capture } = fork;
  return capture;
}

export function buildSingleFileOptions(
  capture: CaptureOptions,
  blockImages: boolean,
): ExtendedSingleFileOptions {
  return {
    // Unchanged upstream choices.
    removeUnusedFonts: true,
    compressHTML: true,
    blockScripts: true,
    blockImages,
    // When images are blocked, SingleFile wipes `srcset` and skips `src`
    // rewriting. Ask it to stash the originals on `data-sf-original-*` so
    // the content script can restore them.
    saveOriginalURLs: blockImages,
    removeAlternativeFonts: true,
    groupDuplicateImages: true,
    maxResourceSizeEnabled: true,

    // Configurable in the fork.
    removeHiddenElements: capture.removeHiddenElements,
    removeUnusedStyles: capture.removeUnusedStyles,
    removeAlternativeMedias: !capture.keepAlternativeImages,
    removeAlternativeImages: !capture.keepAlternativeImages,
    removeFrames: capture.removeFrames,
    maxResourceSize: capture.maxResourceSizeMb,
    passReferrerOnError: capture.passReferrerOnError,
    loadDeferredImages: !blockImages && capture.loadDeferredImages,
    loadDeferredImagesMaxIdleTime: capture.loadDeferredImagesMaxIdleTime,
    loadDeferredImagesDispatchScrollEvent: true,
    // Lazy-loading timers on Firefox go through the extension; see
    // captureBridge.ts.
  };
}
