import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deviceHeartbeat, getDeviceFingerprint } from "@/lib/supabase-tv";

interface VideoItem {
  id: string;
  url: string;
  filename: string;
  duration: number;
  page: number;
}

const CROSSFADE_MS = 600;
const PROJECT_URL = "https://qbslxssxkxgugwkjnlqu.supabase.co";

const Player = () => {
  const { token } = useParams<{ token: string }>();
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [interleavedOrder, setInterleavedOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlistName, setPlaylistName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  const currentIndexRef = useRef(0);
  const interleavedOrderRef = useRef<number[]>([]);
  const playlistRef = useRef<VideoItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const transitioningRef = useRef(false);
  const videoStartTimeRef = useRef(Date.now());
  const deviceIdRef = useRef("");

  const fetchPlaylist = useCallback(async () => {
    const { data: row, error: tokenErr } = await supabase.rpc("get_playlist_by_token", { p_token: token! });
    if (tokenErr || !row || (row as any).error) throw new Error("Token inválido ou expirado");

    const data = row as any;
    setPlaylistName(data.playlist_name);

    const videoUrls: string[] = data.video_urls || [];
    const videoIds: string[] = data.video_ids || [];
    const videoPages: number[] = data.video_pages || [];
    const videoDurations: number[] = data.video_durations || [];

    const videos: VideoItem[] = videoUrls.map((storagePath: string, i: number) => ({
      id: videoIds[i] || String(i),
      url: `${PROJECT_URL}/storage/v1/object/public/videos/${storagePath}`,
      filename: storagePath.split("/").pop() || "",
      duration: videoDurations[i] || 0,
      page: videoPages[i] || 1,
    }));

    setPlaylist(videos);
    playlistRef.current = videos;

    // Build interleaved order
    const pageMap = new Map<number, number[]>();
    videos.forEach((v, i) => {
      const arr = pageMap.get(v.page) || [];
      arr.push(i);
      pageMap.set(v.page, arr);
    });
    const sortedPages = [...pageMap.keys()].sort();
    let order: number[];
    if (sortedPages.length <= 1) {
      order = videos.map((_, i) => i);
    } else {
      order = [];
      const iterators = sortedPages.map((p) => ({ indices: pageMap.get(p)!, pos: 0 }));
      let hasMore = true;
      while (hasMore) {
        hasMore = false;
        for (const it of iterators) {
          if (it.pos < it.indices.length) {
            order.push(it.indices[it.pos]);
            it.pos++;
            if (it.pos < it.indices.length) hasMore = true;
          }
        }
        if (!hasMore) hasMore = iterators.some((it) => it.pos < it.indices.length);
      }
    }
    setInterleavedOrder(order);
    interleavedOrderRef.current = order;
    return videos;
  }, [token]);

  const getVideoByOrder = useCallback((orderIdx: number): VideoItem | undefined => {
    const pl = playlistRef.current;
    const order = interleavedOrderRef.current;
    if (!order.length || !pl.length) return pl[0];
    return pl[order[orderIdx % order.length]];
  }, []);

  const preloadInactive = useCallback((nextIdx: number) => {
    const inactiveRef = activeSlotRef.current === "A" ? videoBRef : videoARef;
    const vid = inactiveRef.current;
    if (!vid) return;
    const nextVideo = getVideoByOrder(nextIdx);
    if (!nextVideo) return;
    if (vid.getAttribute("data-src") !== nextVideo.url) {
      vid.setAttribute("data-src", nextVideo.url);
      vid.src = nextVideo.url;
      vid.preload = "auto";
      vid.load();
    }
  }, [getVideoByOrder]);

  const recordAnalytics = useCallback((video: VideoItem | undefined) => {
    if (!video || !deviceIdRef.current) return;
    const watched = Math.round((Date.now() - videoStartTimeRef.current) / 1000);
    (supabase.rpc as any)("record_analytics", {
      p_device_id: deviceIdRef.current,
      p_video_id: video.id,
      p_duration: watched,
    }).catch(() => {});
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const order = interleavedOrderRef.current;
    if (!order.length) { transitioningRef.current = false; return; }

    // Record analytics for current video
    recordAnalytics(getVideoByOrder(currentIndexRef.current));

    const nextIdx = (currentIndexRef.current + 1) % order.length;
    const isA = activeSlotRef.current === "A";
    const inactiveRef = isA ? videoBRef : videoARef;
    const activeRef   = isA ? videoARef : videoBRef;
    const inactiveVid = inactiveRef.current;
    const activeVid   = activeRef.current;

    if (!inactiveVid) { transitioningRef.current = false; return; }

    // Ensure next video is loaded in inactive slot
    const nextVideo = getVideoByOrder(nextIdx);
    if (nextVideo && inactiveVid.getAttribute("data-src") !== nextVideo.url) {
      inactiveVid.src = nextVideo.url;
      inactiveVid.setAttribute("data-src", nextVideo.url);
      inactiveVid.load();
    }

    inactiveVid.currentTime = 0;
    videoStartTimeRef.current = Date.now();

    // webOS 4.x safe play: try immediately, retry after crossfade if blocked
    const playPromise = inactiveVid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setTimeout(() => {
          inactiveVid.play().catch(() => {});
        }, CROSSFADE_MS + 100);
      });
    }

    // Crossfade via style (refs, não React state — evita re-render durante transição)
    inactiveVid.style.opacity = "1";
    inactiveVid.style.zIndex = "2";
    if (activeVid) {
      activeVid.style.opacity = "0";
      activeVid.style.zIndex = "1";
    }

    setTimeout(() => {
      const newSlot = isA ? "B" : "A";
      activeSlotRef.current = newSlot;
      setActiveSlot(newSlot);
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      transitioningRef.current = false;

      // Preload the video after next
      preloadInactive((nextIdx + 1) % order.length);
    }, CROSSFADE_MS);
  }, [getVideoByOrder, preloadInactive, recordAnalytics]);

  // Initial load
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchPlaylist()
      .then((videos) => {
        if (!videos.length) return;
        const vidA = videoARef.current;
        const vidB = videoBRef.current;
        if (vidA && videos[0]) {
          vidA.src = videos[0].url;
          vidA.setAttribute("data-src", videos[0].url);
          vidA.style.opacity = "1";
          vidA.style.zIndex = "2";
          vidA.load();
        }
        if (vidB && videos[1]) {
          vidB.src = videos[1].url;
          vidB.setAttribute("data-src", videos[1].url);
          vidB.style.opacity = "0";
          vidB.style.zIndex = "1";
          vidB.preload = "auto";
          vidB.load();
        }
        videoStartTimeRef.current = Date.now();
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, fetchPlaylist]);

  // Polling a cada 15s
  useEffect(() => {
    if (!token || !playlist.length) return;
    const interval = setInterval(() => {
      fetchPlaylist().catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [token, playlist.length, fetchPlaylist]);

  // Autoplay
  useEffect(() => {
    if (loading || !playlist.length) return;
    const vid = videoARef.current;
    if (!vid) return;
    const tryPlay = () => {
      const p = vid.play();
      if (p !== undefined) {
        p.then(() => enterFullscreen()).catch(() => setNeedsTap(true));
      }
    };
    if (vid.readyState >= 3) { tryPlay(); return; }
    vid.addEventListener("canplay", tryPlay, { once: true });
  }, [loading, playlist.length]);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {}
  }, []);

  // Wake lock
  useEffect(() => {
    let wakeLock: any = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) wakeLock = await (navigator as any).wakeLock.request("screen");
      } catch {}
    };
    request();
    const onVisibility = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      wakeLock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!token) return;
    const fingerprint = getDeviceFingerprint();
    const sendHeartbeat = () => {
      deviceHeartbeat(token, fingerprint, navigator.userAgent)
        .then((result: any) => { if (result?.device_id) deviceIdRef.current = result.device_id; })
        .catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [token]);

  const handleTapToStart = async () => {
    setNeedsTap(false);
    await enterFullscreen();
    const vid = videoARef.current;
    if (vid) { vid.muted = true; vid.play().catch(() => {}); }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center">
      <div>
        <p className="text-xl font-bold mb-2">Erro</p>
        <p className="text-white/60">{error}</p>
      </div>
    </div>
  );

  if (!playlist.length) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center">
      <p className="text-white/60">Nenhum vídeo na playlist "{playlistName}"</p>
    </div>
  );

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <video
        ref={videoARef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity: 1, transition: `opacity ${CROSSFADE_MS}ms ease-in-out`, zIndex: 2 }}
        autoPlay
        muted
        playsInline
        onEnded={activeSlotRef.current === "A" ? () => handleVideoEnd() : undefined}
        onError={activeSlotRef.current === "A" ? () => handleVideoEnd() : undefined}
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity: 0, transition: `opacity ${CROSSFADE_MS}ms ease-in-out`, zIndex: 1 }}
        autoPlay
        muted
        playsInline
        onEnded={activeSlotRef.current === "B" ? () => handleVideoEnd() : undefined}
        onError={activeSlotRef.current === "B" ? () => handleVideoEnd() : undefined}
      />
      {needsTap && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={handleTapToStart}
        >
          <div className="text-center text-white">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-white/60 flex items-center justify-center">
              <svg className="w-10 h-10 ml-1" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <p className="text-lg font-medium">Toque para iniciar</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;
