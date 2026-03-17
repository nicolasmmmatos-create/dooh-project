import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTvPlayer } from "@/hooks/useTvPlayer";
import { supabase } from "@/integrations/supabase/client";

interface TvPlayerProps {
  token: string;
}

export default function TvPlayer({ token }: TvPlayerProps) {
  const { playlist, videos, loading, error } = useTvPlayer(token);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout>>();
  const isTransitioning = useRef(false);
  const errorCount = useRef(0);
  const videoStartTimeRef = useRef<number>(Date.now());
  const deviceIdRef = useRef<string>("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);

  const transitionType = (playlist && playlist.transition_type !== null && playlist.transition_type !== undefined ? playlist.transition_type : "cut");
  const transitionDuration = transitionType === "cut" ? 150 : (playlist && playlist.transition_duration !== null && playlist.transition_duration !== undefined ? playlist.transition_duration : 600);

  // Build public URLs
  const publicUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of videos) {
      const { data } = supabase.storage.from("videos").getPublicUrl(v.storage_path);
      if (data && data.publicUrl) map[v.storage_path] = data.publicUrl;
    }
    return map;
  }, [videos]);

  // Single navigation function — only way to change index
  const goToNext = useCallback(() => {
    if (isTransitioning.current || videos.length === 0) return;
    isTransitioning.current = true;
    clearTimeout(safetyTimer.current);
    errorCount.current = 0;

    setOpacity(0);

    setTimeout(() => {
      setCurrentIndex(prev =>
        (playlist && playlist.loop)
          ? (prev + 1) % videos.length
          : Math.min(prev + 1, videos.length - 1)
      );
    }, transitionDuration);
  }, [videos.length, playlist && playlist.loop, transitionDuration]);

  // Single useEffect — reacts to currentIndex, loads and plays
  useEffect(() => {
    const v = videoRef.current;
    if (!v || videos.length === 0) return;

    const video = videos[currentIndex];
    if (!video) return;

    const url = publicUrls[video.storage_path];
    if (!url) return;

    v.src = url;
    v.load();

    const handleReady = () => {
      clearTimeout(safetyTimer.current);
      v.removeEventListener("canplay", handleReady);
      setOpacity(1);
      isTransitioning.current = false;
      v.play().catch(() => {});
    };

    v.addEventListener("canplay", handleReady, { once: true });

    safetyTimer.current = setTimeout(handleReady, 2000);

    return () => {
      v.removeEventListener("canplay", handleReady);
      clearTimeout(safetyTimer.current);
    };
  }, [currentIndex, videos, publicUrls]);

  // Video error handler
  const handleVideoError = useCallback(() => {
    errorCount.current++;
    if (errorCount.current >= 3) {
      errorCount.current = 0;
      isTransitioning.current = false;
      goToNext();
    } else {
      const v = videoRef.current;
      if (!v) return;
      const src = v.src;
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.src = src;
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }, 1000 * errorCount.current);
    }
  }, [goToNext]);

  // Error retry every 30s
  useEffect(() => {
    if (error && videos.length === 0) {
      retryTimerRef.current = setInterval(() => {
        window.location.reload();
      }, 30_000);
      return () => {
        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      };
    }
  }, [error, videos.length]);

  // Fullscreen: robust strategy for webOS 6+ (LG OLED) and older
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const tryFullscreen = () => {
      const target = document.documentElement;
      const req =
        (target.requestFullscreen ? target.requestFullscreen.bind(target) : null) ||
        ((target as any).webkitRequestFullscreen ? (target as any).webkitRequestFullscreen.bind(target) : null) ||
        ((target as any).mozRequestFullScreen ? (target as any).mozRequestFullScreen.bind(target) : null) ||
        ((target as any).msRequestFullscreen ? (target as any).msRequestFullscreen.bind(target) : null);
      return req ? req() : Promise.reject("no api");
    };

    tryFullscreen().catch(() => {
      const style = document.createElement("style");
      style.innerHTML = `
        html, body {
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(style);
    });

    const retryOnInteraction = () => {
      if (!document.fullscreenElement) {
        tryFullscreen().catch(() => {});
      }
      document.removeEventListener("click", retryOnInteraction);
      document.removeEventListener("keydown", retryOnInteraction);
    };
    document.addEventListener("click", retryOnInteraction);
    document.addEventListener("keydown", retryOnInteraction);

    return () => {
      document.removeEventListener("click", retryOnInteraction);
      document.removeEventListener("keydown", retryOnInteraction);
    };
  }, []);

  const rootStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "black",
    zIndex: 2147483647,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div ref={containerRef} className="tv-player-root flex items-center justify-center" style={rootStyle}>
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div ref={containerRef} className="tv-player-root flex items-center justify-center" style={rootStyle}>
        <p className="text-white/60 text-lg">Conteúdo indisponível. Tentando reconectar...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tv-player-root" style={rootStyle}>
      {/* ALWAYS mounted — never conditional */}
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        controls={false}
        preload="auto"
        crossOrigin="anonymous"
        {...({ "webkit-playsinline": "true", "x-webkit-airplay": "deny" } as any)}
        onEnded={goToNext}
        onError={handleVideoError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity,
          transition: `opacity ${transitionDuration}ms ease-in-out`,
        }}
      />

      {opacity === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
