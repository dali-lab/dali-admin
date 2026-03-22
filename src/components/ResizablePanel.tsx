import { useRef, useCallback, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export default function ResizablePanel({
  children,
  defaultWidth = 380,
  minWidth = 280,
  maxWidth = 720,
  className = "",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(defaultWidth);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelRef.current?.offsetWidth ?? widthRef.current;

      function onMove(ev: MouseEvent) {
        const delta = startX - ev.clientX;
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
        widthRef.current = next;
        if (panelRef.current) panelRef.current.style.width = `${next}px`;
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [minWidth, maxWidth]
  );

  return (
    <div
      ref={panelRef}
      style={{ width: defaultWidth }}
      className={`shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-y-auto relative ${className}`}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#00C795]/40 active:bg-[#00C795]/60 transition-colors z-20 group"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-gray-300 group-hover:bg-[#00C795] group-active:bg-[#00C795] transition-colors" />
      </div>
      {children}
    </div>
  );
}
