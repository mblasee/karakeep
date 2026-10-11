# Karakeep Fork (balazsdev): build notes

Personal fork of the official Karakeep browser extension
(<https://github.com/karakeep-app/karakeep>, `apps/browser-extension`),
rebased onto each upstream extension release (`extension/vX.Y.Z` tags).

## What the fork changes

All fork code lives in `src/fork/`; upstream files only get small hooks.

- Configurable SingleFile capture options (Options page, under
  "Client-side crawling"): lazy images, unused CSS, hidden elements, image
  size variants, frames, referrer retry, max resource size, capture timeout.
- SingleFile's page hooks are injected so lazy-loaded images are loaded
  before capture; page resources are downloaded through the extension popup,
  so cross-origin images aren't lost to CORS.
- On Reddit post pages, the post's `.json` (fetched with the user's own
  session) is attached to the bookmark as an HTML file.
- Own add-on name/ID and data-collection declaration (`src/fork/manifest.ts`,
  merged over `manifest.json` in `vite.config.ts`).

## Reproducing the build (for reviewers)

Requirements: Node.js 24 and pnpm in the version pinned by the root
`package.json` (`packageManager`, used automatically via corepack), on Linux
or macOS.

```sh
corepack enable
pnpm install --frozen-lockfile --filter "@karakeep/browser-extension..."
cd apps/browser-extension
VITE_BUILD_FIREFOX=true pnpm run build --outDir fork-out/dist-firefox
```

The add-on is `apps/browser-extension/fork-out/dist-firefox/`. The CI build
additionally stamps `version` and `browser_specific_settings.gecko.update_url`
into `manifest.json` before building; those values are included in the
uploaded source archive.

With Docker instead of a local Node install:

```sh
docker compose -f compose.fork.yaml run --rm build
```
