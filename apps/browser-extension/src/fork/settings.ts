/**
 * Fork-only settings. Kept in their own file (and nested under a single
 * `fork` key in the upstream settings schema) so rebasing onto new upstream
 * releases only ever touches a couple of lines in upstream files.
 */
import { z } from "zod";

export const zForkSettingsSchema = z.object({
  // --- SingleFile capture options (client-side crawling) ---
  /** Scroll/zoom the page so lazy-loaded images are fetched before capture. */
  loadDeferredImages: z.boolean().default(true),
  /** How long to wait (ms) for lazy-loaded images to settle. */
  loadDeferredImagesMaxIdleTime: z
    .number()
    .int()
    .min(250)
    .max(30000)
    .default(1500),
  /** Drop elements that are hidden at capture time (upstream default: on). */
  removeHiddenElements: z.boolean().default(false),
  /** Drop CSS rules not used at capture time, e.g. desktop media queries (upstream default: on). */
  removeUnusedStyles: z.boolean().default(false),
  /** Keep srcset / <picture> / media alternatives so other screen sizes still work (upstream default: off). */
  keepAlternativeImages: z.boolean().default(true),
  /** Drop iframes/embeds (upstream default: on). */
  removeFrames: z.boolean().default(true),
  /** Retry blocked cross-origin resources with a Referer header. */
  passReferrerOnError: z.boolean().default(true),
  /** Skip any single resource larger than this (MB). */
  maxResourceSizeMb: z.number().int().min(1).max(100).default(10),
  /** Give up on the capture after this many seconds (upstream: 60). */
  captureTimeoutSec: z.number().int().min(10).max(600).default(120),

  // --- Reddit ---
  /** On Reddit post pages, also save the post's .json as an attachment. */
  redditJsonAttachment: z.boolean().default(true),
});

export type ForkSettings = z.infer<typeof zForkSettingsSchema>;

export const DEFAULT_FORK_SETTINGS: ForkSettings = zForkSettingsSchema.parse(
  {},
);

/**
 * The field as embedded in the upstream settings schema: missing keys get
 * defaults, and a broken fork object falls back to defaults instead of
 * invalidating the whole settings object (which would look like a logout).
 */
export const zForkSettingsField = zForkSettingsSchema
  .prefault({})
  .catch(DEFAULT_FORK_SETTINGS);
