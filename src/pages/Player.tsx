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

  const buildOrder = (videos: VideoItem[]) => {
    const pageMap = new Map<number, number[]>();
    videos.forEach((v, i) => {
      const arr = pageMap.get(v.page) || [];
      arr.push(i);
      pageMap.set(v.page, arr);
    });
    const sortedPages = [...pageMap.keys()].sort();
    if (sortedPages.length <= 1) return videos.map((_, i) => i);
    const order: number[] = [];
    const iterators = sortedPages.map((p) => ({ indices: pageMap.get(p)!, pos: 0 }));
    let hasMore = true;
    while (hasMore) {
      hasMore = false;
      for (const it of iterators) {
        if (it.pos < it.indices.length) {
          order.push(it.indices[it.pos++]);
          if (it.pos < it.indices.length) hasMore = true;
        }
      }
      if (!hasMore) hasMore = iterators.some((it) => it.pos < it.indices.length);
    }
    return order;
  };

 const fetchPlaylist = useCallback(async () => {
  const { data: tokenRows, error: tokenErr } = await (supabase.rpc as any)("validate_token", { p_token: token! });
  if (tokenErr || !tokenRows || (tokenRows as any[]).length === 0) throw new Error("Token inválido ou expirado");

  const row = tokenRows[0] as any;
  setPlaylistName(row.playlist_name);
  setPlaylistId(row.playlist_id);

  const videoUrls: string[] = row.video_urls || [];
  const videoPages: number[] = row.video_pages || [];

const videos: VideoItem[] = videoUrls.map((storagePath: string, i: number) => ({
      id: String(i),
      url: `https://qbslxssxkxgugwkjnlqu.supabase.co/storage/v1/object/public/videos/${storagePath}`,
      filename: storagePath.split("/").pop() || "",
      page: videoPages[i] || 1,
    }));

  setPlaylist(videos);

  const pageMap = new Map<number, number[]>();
  videos.forEach((v, i) => {
    const arr = pageMap.get(v.page) || [];
    arr.push(i);
    pageMap.set(v.page, arr);
  });

  const sortedPages = [...pageMap.keys()].sort();
  if (sortedPages.length <= 1) {
    setInterleavedOrder(videos.map((_, i) => i));
  } else {
    const order: number[] = [];
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
    setInterleavedOrder(order);
  }

  console.log("Playlist:", row.playlist_name, "-", videos.length, "vídeos");
  return videos;
}, [token]);

    const order = buildOrder(videos);
    setPlaylist(videos);
    setInterleavedOrder(order);
    playlistRef.current = videos;
    interleavedOrderRef.current = order;
    return videos;
  }, [token]);

  const getVideoByOrder = useCallback((idx: number): VideoItem | undefined => {
    const pl = playlistRef.current;
    const order = interleavedOrderRef.current;
    if (!order.length || !pl.length) return pl[0];
    return pl[order[idx % order.length]];
  }, []);

  const preloadInactive = useCallback((nextIdx: number) => {
    const vid = (activeSlotRef.current === "A" ? videoBRef : videoARef).current;
    if (!vid) return;
    const next = getVideoByOrder(nextIdx);
    if (next && vid.getAttribute("data-preload") !== next.url) {
      vid.setAttribute("data-preload", next.url);
      vid.src = next.url;
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

    recordAnalytics(getVideoByOrder(currentIndexRef.current));

    const nextIdx = (currentIndexRef.current + 1) % order.length;
    const isA = activeSlotRef.current === "A";
    const inactiveVid = (isA ? videoBRef : videoARef).current;
    const activeVid   = (isA ? videoARef : videoBRef).current;
    if (!inactiveVid) { transitioningRef.current = false; return; }

    const nextVideo = getVideoByOrder(nextIdx);
    if (nextVideo && inactiveVid.getAttribute("data-preload") !== nextVideo.url) {
      inactiveVid.src = nextVideo.url;
      inactiveVid.setAttribute("data-preload", nextVideo.url);
      inactiveVid.load();
    }

    inactiveVid.currentTime = 0;
    videoStartTimeRef.current = Date.now();

    const p = inactiveVid.play();
    if (p !== undefined) {
      p.catch(() => setTimeout(() => inactiveVid.play().catch(() => {}), CROSSFADE_MS + 100));
    }

    inactiveVid.style.opacity = "1";
    inactiveVid.style.zIndex  = "2";
    if (activeVid) { activeVid.style.opacity = "0"; activeVid.style.zIndex = "1"; }

    setTimeout(() => {
      const newSlot = isA ? "B" : "A";
      activeSlotRef.current = newSlot;
      setActiveSlot(newSlot);
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      transitioningRef.current = false;
      preloadInactive((nextIdx + 1) % order.length);
    }, CROSSFADE_MS);
  }, [getVideoByOrder, preloadInactive, recordAnalytics]);

  // Carregamento inicial
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
          vidA.setAttribute("data-preload", videos[0].url);
          vidA.style.opacity = "1";
          vidA.style.zIndex  = "2";
          vidA.load();
        }
        if (vidB && videos[1]) {
          vidB.src = videos[1].url;
          vidB.setAttribute("data-preload", videos[1].url);
          vidB.style.opacity = "0";
          vidB.style.zIndex  = "1";
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
    const iv = setInterval(() => fetchPlaylist().catch(() => {}), 15_000);
    return () => clearInterval(iv);
  }, [token, playlist.length, fetchPlaylist]);

  // Autoplay
  useEffect(() => {
    if (loading || !playlist.length) return;
    const vid = videoARef.current;
    if (!vid) return;
    const tryPlay = () => {
      const p = vid.play();
      if (p !== undefined) p.then(() => enterFullscreen()).catch(() => setNeedsTap(true));
    };
    if (vid.readyState >= 3) { tryPlay(); return; }
    vid.addEventListener("canplay", tryPlay, { once: true });
  }, [loading, playlist.length]);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try { if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen(); } catch {}
  }, []);

  // Wake lock
  useEffect(() => {
    let wl: any = null;
    const req = async () => {
      try { if ("wakeLock" in navigator) wl = await (navigator as any).wakeLock.request("screen"); } catch {}
    };
    req();
    const onVis = () => { if (document.visibilityState === "visible") req(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { wl?.release().catch(() => {}); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!token) return;
    const fp = getDeviceFingerprint();
    const hb = () => deviceHeartbeat(token, fp, navigator.userAgent)
      .then((r: any) => { if (r?.device_id) deviceIdRef.current = r.device_id; })
      .catch(() => {});
    hb();
    const iv = setInterval(hb, 60_000);
    return () => clearInterval(iv);
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
