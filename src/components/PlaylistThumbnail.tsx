import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { Film } from "lucide-react";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface PlaylistThumbnailProps {
  videoUrls: string[];
}

const PlaylistThumbnail = memo(React.forwardRef<HTMLDivElement, PlaylistThumbnailProps>(({ videoUrls }, _ref) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const durationsRef = useRef<number[]>([]);
  const totalDurationRef = useRef(0);
  const currentIndexRef = useRef(-1);
  const readyRef = useRef(false);

  // DOM refs for scrub UI (no re-renders)
  const lineRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  // Preload durations for all videos
  useEffect(() => {
    if (videoUrls.length === 0) return;
    let cancelled = false;

    const loadDurations = async () => {
      const durations: number[] = [];
      for (const url of videoUrls) {
        const dur = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.muted = true;
          v.src = url;
          v.onloadedmetadata = () => { resolve(v.duration || 5); v.src = ""; };
          v.onerror = () => { resolve(5); v.src = ""; };
        });
        if (cancelled) return;
        durations.push(dur);
      }
      durationsRef.current = durations;
      totalDurationRef.current = durations.reduce((a, b) => a + b, 0);
    };

    loadDurations();
    return () => { cancelled = true; };
  }, [videoUrls]);

  // Generate static thumbnail from first video
  useEffect(() => {
    if (videoUrls.length === 0) return;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.src = videoUrls[0];

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 4);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.round((320 / video.videoWidth) * video.videoHeight) || 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbnailUrl(canvas.toDataURL("image/jpeg", 0.6));
    };

    return () => { video.src = ""; };
  }, [videoUrls]);

  // Update scrub UI via direct DOM manipulation (no state)
  const updateScrubUI = useCallback((progress: number) => {
    const pct = `${progress * 100}%`;
    if (lineRef.current) lineRef.current.style.left = pct;
    if (barFillRef.current) barFillRef.current.style.width = pct;
    if (tooltipRef.current) {
      tooltipRef.current.style.left = pct;
      if (totalDurationRef.current > 0) {
        tooltipRef.current.textContent = `${formatTime(progress * totalDurationRef.current)} / ${formatTime(totalDurationRef.current)}`;
      }
    }
  }, []);

  const seekToProgress = useCallback((progress: number) => {
    const vid = videoRef.current;
    if (!vid || totalDurationRef.current === 0) return;

    const targetTime = progress * totalDurationRef.current;
    const durations = durationsRef.current;

    let accumulated = 0;
    let targetIndex = 0;
    let localTime = 0;

    for (let i = 0; i < durations.length; i++) {
      if (accumulated + durations[i] > targetTime) {
        targetIndex = i;
        localTime = targetTime - accumulated;
        break;
      }
      accumulated += durations[i];
      if (i === durations.length - 1) {
        targetIndex = i;
        localTime = durations[i];
      }
    }

    if (targetIndex !== currentIndexRef.current || !readyRef.current) {
      currentIndexRef.current = targetIndex;
      readyRef.current = false;
      vid.src = videoUrls[targetIndex];
      vid.load();
      vid.onloadeddata = () => {
        readyRef.current = true;
        vid.currentTime = Math.min(localTime, vid.duration - 0.01);
      };
    } else if (readyRef.current) {
      vid.currentTime = Math.min(localTime, vid.duration - 0.01);
    }
  }, [videoUrls]);

  const startPreview = useCallback(() => {
    if (videoUrls.length === 0) return;
    setHovering(true);
    readyRef.current = false;
    currentIndexRef.current = -1;
  }, [videoUrls.length]);

  const stopPreview = useCallback(() => {
    setHovering(false);
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

    // Update UI immediately via DOM (no re-render)
    updateScrubUI(progress);

    // Throttle video seeks via rAF
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      seekToProgress(progress);
    });
  }, [updateScrubUI, seekToProgress]);

  if (videoUrls.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <Film className="w-8 h-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="aspect-video bg-muted rounded-lg overflow-hidden relative cursor-col-resize"
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onMouseMove={handleMouseMove}
    >
      {/* Static thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Playlist preview"
          className={`w-full h-full object-cover transition-opacity duration-200 ${hovering ? "opacity-0" : "opacity-100"}`}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center transition-opacity ${hovering ? "opacity-0" : "opacity-100"}`}>
          <Film className="w-8 h-8 text-muted-foreground/30" />
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
  );
}));

PlaylistThumbnail.displayName = "PlaylistThumbnail";

export default PlaylistThumbnail;
