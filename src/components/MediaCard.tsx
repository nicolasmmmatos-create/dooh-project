import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Film } from "lucide-react";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface MediaCardProps {
  url: string;
  filename: string;
  fileSize: number | null;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
}

const MediaCard = memo(({ url, filename, fileSize, selected, onToggleSelect, onPreview }: MediaCardProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);
  const readyRef = useRef(false);

  // DOM refs for scrub UI (no re-renders)
  const lineRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef(0);
  const rafRef = useRef(0);

  // Generate thumbnail on mount
  useEffect(() => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    video.onloadedmetadata = () => {
      durationRef.current = video.duration || 0;
      video.currentTime = Math.min(2, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.round((320 / video.videoWidth) * video.videoHeight) || 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbnailUrl(canvas.toDataURL("image/jpeg", 0.7));
    };

    return () => { video.src = ""; };
  }, [url]);

  // Update scrub UI via direct DOM manipulation (no state)
  const updateScrubUI = useCallback((progress: number) => {
    const pct = `${progress * 100}%`;
    if (lineRef.current) lineRef.current.style.left = pct;
    if (barFillRef.current) barFillRef.current.style.width = pct;
    if (tooltipRef.current) {
      tooltipRef.current.style.left = pct;
      if (durationRef.current > 0) {
        tooltipRef.current.textContent = `${formatTime(progress * durationRef.current)} / ${formatTime(durationRef.current)}`;
      }
    }
  }, []);

  const startPreview = useCallback(() => {
    setHovering(true);
    readyRef.current = false;
    const vid = videoRef.current;
    if (!vid) return;
    vid.src = url;
    vid.load();
    vid.onloadeddata = () => {
      readyRef.current = true;
      durationRef.current = vid.duration || 0;
    };
  }, [url]);

  const stopPreview = useCallback(() => {
    setHovering(false);
    scrubRef.current = 0;
    readyRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    scrubRef.current = progress;

    // Update UI immediately via DOM (no re-render)
    updateScrubUI(progress);

    // Throttle video seeks via rAF
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const vid = videoRef.current;
      if (vid && readyRef.current && durationRef.current > 0) {
        vid.currentTime = Math.min(progress * durationRef.current, durationRef.current - 0.01);
      }
    });
  }, [updateScrubUI]);

  return (
    <div
      className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-glow ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div
        ref={containerRef}
        className="aspect-video bg-muted relative overflow-hidden cursor-col-resize"
        onClick={onPreview}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
        onMouseMove={handleMouseMove}
      >
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={filename}
            className={`w-full h-full object-cover transition-opacity duration-200 ${hovering ? "opacity-0" : "opacity-100"}`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center transition-opacity ${hovering ? "opacity-0" : "opacity-100"}`}>
            <Film className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Scrub video — never unmounted */}
        <video
          ref={videoRef}
          muted
          playsInline
          preload="none"
          crossOrigin="anonymous"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${hovering ? "opacity-100" : "opacity-0"}`}
        />

        {/* Timeline scrub indicator — positioned via refs, no state */}
        {hovering && (
          <>
            <div
              ref={tooltipRef}
              className="absolute top-2 pointer-events-none z-20 -translate-x-1/2 px-1.5 py-0.5 rounded bg-popover/90 border border-border text-[10px] font-mono text-popover-foreground shadow-md whitespace-nowrap"
              style={{ left: "0%" }}
            />
            <div
              ref={lineRef}
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-10"
              style={{
                left: "0%",
                background: "hsl(var(--primary))",
                boxShadow: "0 0 6px hsl(var(--primary) / 0.7), 0 0 12px hsl(var(--primary) / 0.3)",
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40 pointer-events-none">
              <div
                ref={barFillRef}
                className="h-full"
                style={{
                  width: "0%",
                  background: "linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary)))",
                  boxShadow: "0 0 8px hsl(var(--primary) / 0.5)",
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="p-3 bg-card flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{filename}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {fileSize ? `${(fileSize / 1024 / 1024).toFixed(1)}MB` : "—"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="ml-2 accent-primary"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
});

MediaCard.displayName = "MediaCard";

export default MediaCard;
