import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { isElectron } from "~/env";
import { useResizableWidth } from "~/hooks/useResizableWidth";
import { cn } from "~/lib/utils";

import { RightPanelResizeHandle } from "./RightPanelResizeHandle";

export type PreviewPanelMode = "inline" | "sheet" | "sidebar" | "embedded";

const PREVIEW_PANEL_WIDTH_STORAGE_KEY = "t3code:preview-panel-width";
const PREVIEW_PANEL_MIN_WIDTH = 360;
/** Space reserved for the chat column when the panel is dragged to its max. */
const PREVIEW_PANEL_CHAT_RESERVED_PX = 480;
/** Fraction of the viewport always allowed, so narrow windows behave as before. */
const PREVIEW_PANEL_MAX_WIDTH_FRACTION = 0.7;
const PREVIEW_PANEL_DEFAULT_WIDTH = 540;

/**
 * Shell for the preview panel. In inline mode the panel is user-resizable
 * via a drag handle on the left edge; width persists per browser. In
 * sheet/sidebar modes the parent owns the size.
 */
export function PreviewPanelShell(props: {
  mode: PreviewPanelMode;
  maximized?: boolean;
  children: ReactNode;
}) {
  const useDragRegion = isElectron && props.mode !== "sheet" && props.mode !== "embedded";
  const isInline = props.mode === "inline";
  const rootRef = useRef<HTMLDivElement>(null);
  const maxWidth = usePanelRowClampedMaxWidth(rootRef, props.mode);
  const { width, handlers } = useResizableWidth({
    storageKey: PREVIEW_PANEL_WIDTH_STORAGE_KEY,
    defaultWidth: PREVIEW_PANEL_DEFAULT_WIDTH,
    minWidth: PREVIEW_PANEL_MIN_WIDTH,
    maxWidth,
    edge: "left",
  });

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-full min-h-0 min-w-0 flex-col self-stretch bg-background",
        isInline
          ? props.maximized
            ? "flex-1 border-l border-border"
            : "shrink-0 border-l border-border"
          : "w-full",
      )}
      style={isInline && !props.maximized ? { width: `${width}px` } : undefined}
      data-preview-panel-mode={props.mode}
      data-preview-panel-maximized={props.maximized ? "true" : "false"}
    >
      {isInline && !props.maximized ? <RightPanelResizeHandle handlers={handlers} /> : null}
      {useDragRegion ? <div className="electron-drag-region h-0 w-full" aria-hidden /> : null}
      {props.children}
    </div>
  );
}

/**
 * Track the width of the flex row hosting the panel (chat column + panel) to
 * derive an upper bound that always leaves the chat column usable space.
 * Measuring the row rather than the viewport keeps the reserve honest when
 * the app sidebar takes part of the window. Resize-aware (window resizes and
 * sidebar collapse/expand both change the row) so the stored width re-clamps
 * on the next render (the hook's clamp picks this up automatically).
 */
function usePanelRowClampedMaxWidth(
  panelRef: RefObject<HTMLDivElement | null>,
  mode: PreviewPanelMode,
): number {
  const [rowWidth, setRowWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  useEffect(() => {
    const row = panelRef.current?.parentElement;
    if (!row) return;
    const observer = new ResizeObserver(() => {
      setRowWidth(row.clientWidth);
    });
    observer.observe(row);
    return () => observer.disconnect();
    // The panel remounts into a different parent when the mode changes.
  }, [panelRef, mode]);
  return Math.max(
    PREVIEW_PANEL_MIN_WIDTH,
    Math.floor(rowWidth * PREVIEW_PANEL_MAX_WIDTH_FRACTION),
    rowWidth - PREVIEW_PANEL_CHAT_RESERVED_PX,
  );
}
