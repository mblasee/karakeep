/**
 * Fork-only settings UI, rendered from OptionsPage.
 */
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import usePluginSettings from "../utils/settings";
import { ForkSettings } from "./settings";

type BoolKey = {
  [K in keyof ForkSettings]: ForkSettings[K] extends boolean ? K : never;
}[keyof ForkSettings];
type NumKey = {
  [K in keyof ForkSettings]: ForkSettings[K] extends number ? K : never;
}[keyof ForkSettings];

// Values outside these ranges would fail the settings schema, which makes the
// extension fall back to defaults (i.e. look logged out) — so always clamp.
const RANGES: Record<NumKey, [number, number]> = {
  loadDeferredImagesMaxIdleTime: [250, 30000],
  maxResourceSizeMb: [1, 100],
  captureTimeoutSec: [10, 600],
};

function useForkSettings() {
  const { settings, setSettings } = usePluginSettings();
  const fork = settings.fork;
  const setBool = (key: BoolKey, value: boolean) =>
    setSettings((s) => ({ ...s, fork: { ...s.fork, [key]: value } }));
  const setNum = (key: NumKey, raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      return;
    }
    const [min, max] = RANGES[key];
    const value = Math.min(max, Math.max(min, parsed));
    return setSettings((s) => ({ ...s, fork: { ...s.fork, [key]: value } }));
  };
  return { fork, setBool, setNum };
}

function ToggleRow(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 pl-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{props.label}</span>
        {props.hint && (
          <span className="text-xs text-gray-500">{props.hint}</span>
        )}
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function NumberRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (raw: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pl-4">
      <span className="text-sm font-medium">{props.label}</span>
      <Input
        type="number"
        min={props.min}
        max={props.max}
        step="1"
        // Uncontrolled + commit on blur, so half-typed values aren't saved.
        key={props.value}
        defaultValue={props.value}
        onBlur={(e) => props.onCommit(e.target.value)}
        className="w-28"
      />
    </div>
  );
}

/** Extra capture options, shown under "Client-side crawling". */
export function ForkCaptureOptions() {
  const { fork, setBool, setNum } = useForkSettings();
  return (
    <>
      <ToggleRow
        label="Load lazy images"
        hint="Scrolls the page virtually so lazy-loaded images are fetched before capture."
        checked={fork.loadDeferredImages}
        onChange={(v) => setBool("loadDeferredImages", v)}
      />
      {fork.loadDeferredImages && (
        <NumberRow
          label="Lazy image wait (ms)"
          value={fork.loadDeferredImagesMaxIdleTime}
          min={RANGES.loadDeferredImagesMaxIdleTime[0]}
          max={RANGES.loadDeferredImagesMaxIdleTime[1]}
          onCommit={(v) => setNum("loadDeferredImagesMaxIdleTime", v)}
        />
      )}
      <ToggleRow
        label="Keep layout for all screen sizes"
        hint="Keeps unused CSS (e.g. desktop rules when saving on a phone). Larger files."
        checked={!fork.removeUnusedStyles}
        onChange={(v) => setBool("removeUnusedStyles", !v)}
      />
      <ToggleRow
        label="Keep hidden elements"
        hint="Keeps elements that were hidden at capture time (menus, collapsed parts)."
        checked={!fork.removeHiddenElements}
        onChange={(v) => setBool("removeHiddenElements", !v)}
      />
      <ToggleRow
        label="Keep image size variants"
        hint="Keeps srcset/<picture> alternatives so images fit other screens."
        checked={fork.keepAlternativeImages}
        onChange={(v) => setBool("keepAlternativeImages", v)}
      />
      <ToggleRow
        label="Keep frames / embeds"
        checked={!fork.removeFrames}
        onChange={(v) => setBool("removeFrames", !v)}
      />
      <ToggleRow
        label="Retry blocked resources with Referer"
        checked={fork.passReferrerOnError}
        onChange={(v) => setBool("passReferrerOnError", v)}
      />
      <NumberRow
        label="Max size per resource (MB)"
        value={fork.maxResourceSizeMb}
        min={RANGES.maxResourceSizeMb[0]}
        max={RANGES.maxResourceSizeMb[1]}
        onCommit={(v) => setNum("maxResourceSizeMb", v)}
      />
      <NumberRow
        label="Capture timeout (s)"
        value={fork.captureTimeoutSec}
        min={RANGES.captureTimeoutSec[0]}
        max={RANGES.captureTimeoutSec[1]}
        onCommit={(v) => setNum("captureTimeoutSec", v)}
      />
    </>
  );
}

/** Reddit JSON attachment toggle. */
export function ForkRedditOptions() {
  const { fork, setBool } = useForkSettings();
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium">Attach Reddit JSON</span>
        <span className="text-xs text-gray-500">
          On Reddit posts, also saves the post and comments as JSON in an
          attachment. Needs you to be logged in to Reddit in this browser.
        </span>
      </div>
      <Switch
        checked={fork.redditJsonAttachment}
        onCheckedChange={(v) => setBool("redditJsonAttachment", v)}
      />
    </div>
  );
}
