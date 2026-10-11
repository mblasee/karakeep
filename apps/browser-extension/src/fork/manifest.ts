/**
 * Fork-only: the add-on's own identity, merged over upstream's manifest.json
 * at build time (see vite.config.ts). Keeping this out of manifest.json means
 * upstream's version bumps never conflict with the fork when rebasing.
 */
// Loose shape on purpose: crxjs' manifest type doesn't know newer Firefox keys
// such as `data_collection_permissions`.
type Manifest = Record<string, unknown> & {
  browser_specific_settings?: {
    gecko?: Record<string, unknown>;
    gecko_android?: Record<string, unknown>;
  };
};

export function applyForkManifest<T extends object>(upstream: T): T {
  const m = upstream as Manifest;
  return {
    ...m,
    name: "Karakeep Fork (balazsdev)",
    description:
      "Personal build of the Karakeep extension with configurable client-side capture and Reddit JSON attachments.",
    browser_specific_settings: {
      ...m.browser_specific_settings,
      gecko: {
        // Keeps anything set upstream or by CI (e.g. update_url).
        ...m.browser_specific_settings?.gecko,
        id: "karakeep-fork@balazsdev.com",
        strict_min_version: "140.0",
        // Required for new add-ons since Nov 2025. Page URLs and content go
        // to your Karakeep server, and you sign in to it.
        data_collection_permissions: {
          required: [
            "browsingActivity",
            "websiteContent",
            "authenticationInfo",
          ],
        },
      },
      gecko_android: {
        ...m.browser_specific_settings?.gecko_android,
        // MV3 `scripting` with world: "MAIN" + data-consent UI.
        strict_min_version: "142.0",
      },
    },
  } as unknown as T;
}
