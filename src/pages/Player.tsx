import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deviceHeartbeat, getDeviceFingerprint } from "@/lib/supabase-tv";

interface VideoItem {
  id: string;
  url: string;
  filename: string;
  page: number;
}

const CROSSFADE_MS = 800;

const Player = () => {
  const { token } = useParams<{ token: string }>();
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [interleavedOrder, setInterleavedOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string>("");

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [opacityA, setOpacityA] = useState(1);
  const [opacityB, setOpacityB] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextIndexRef = useRef(0);
  const [needsTap, setNeedsTap] = useState(false);

  const fetchPlaylist = useCallback(async () => {
    const { data: tokenRows, error: tokenErr } = await (supabase.rpc as any)("validate_token", { p_token: token! });
    if (tokenErr || !tokenRows || (tokenRows as any[]).length === 0) throw new Error("Token inválido ou expirado");

    const row = tokenRows[0] as any;
    setPlaylistName(row.playlist_name);
    setPlaylistId(row.playlist_id);

    const videoUrls: string[] = row.video_urls || [];
    const videoPages: number[] = row.video_pages || [];

    const videos: VideoItem[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const storagePath = videoUrls[i];
      const { data: signedData } = await supabase.storage
        .from("videos")
        .createSignedUrl(storagePath, 3600);
      if (signedData?.signedUrl) {
        videos.push({
          id: String(i),
          url: signedData.signedUrl,
          filename: storagePath.split("/").pop() || "",
          page: videoPages[i] || 1,
        });
      }
    }

    setPlaylist(videos);

    // Build interleaved order: Page1[0], Page2[0], Page1[1], Page2[1], ...
    const pageMap = new Map<number, number[]>();
    videos.forEach((v, i) => {
      const arr = pageMap.get(v.page) || [];
      arr.push(i);
      pageMap.set(v.page, arr);
    });

    const sortedPages = [...pageMap.keys()].sort();
    if (sortedPages.length <= 1) {
      // Single page, play sequentially
      setInterleavedOrder(videos.map((_, i) => i));
    } else {
      // Interleave: cycle through pages round-robin
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
        // Check if any iterator still has items
        if (!hasMore) {
          hasMore = iterators.some((it) => it.pos < it.indices.length);
        }
      }
      setInterleavedOrder(order);
    }

    console.log("Playlist:", row.playlist_name, "-", videos.length, "vídeos,", sortedPages.length, "página(s)");
    return videos;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchPlaylist()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, fetchPlaylist]);

  useEffect(() => {
    if (!token || playlist.length === 0) return;
    const interval = setInterval(() => {
      fetchPlaylist().catch(() => {});
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, playlist.length, fetchPlaylist]);

  const getVideoByOrder = (orderIdx: number) => {
    if (interleavedOrder.length === 0) return playlist[0];
    const videoIdx = interleavedOrder[orderIdx % interleavedOrder.length];
    return playlist[videoIdx];
  };

  const preloadNext = useCallback((nextIdx: number) => {
    const inactiveRef = activeSlot === "A" ? videoBRef : videoARef;
    const vid = inactiveRef.current;
    if (!vid || interleavedOrder.length === 0) return;
    const nextVideo = getVideoByOrder(nextIdx);
    if (nextVideo && vid.src !== nextVideo.url) {
      vid.src = nextVideo.url;
      vid.load();
    }
  }, [activeSlot, interleavedOrder, playlist]);

  useEffect(() => {
    if (interleavedOrder.length <= 1) return;
    const next = (currentIndex + 1) % interleavedOrder.length;
    nextIndexRef.current = next;
    preloadNext(next);
  }, [currentIndex, interleavedOrder, preloadNext]);

  const handleVideoEnd = useCallback(() => {
    if (interleavedOrder.length === 0) return;
    const nextIdx = (currentIndex + 1) % interleavedOrder.length;
    nextIndexRef.current = nextIdx;
    const inactiveRef = activeSlot === "A" ? videoBRef : videoARef;
    const vid = inactiveRef.current;

    if (activeSlot === "A") {
      setOpacityB(1);
      vid?.play().catch(() => {});
      setTimeout(() => {
        setOpacityA(0);
        setActiveSlot("B");
        setCurrentIndex(nextIdx);
      }, CROSSFADE_MS);
    } else {
      setOpacityA(1);
      vid?.play().catch(() => {});
      setTimeout(() => {
        setOpacityB(0);
        setActiveSlot("A");
        setCurrentIndex(nextIdx);
      }, CROSSFADE_MS);
    }
  }, [activeSlot, interleavedOrder, currentIndex]);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const vid = activeSlot === "A" ? videoARef.current : videoBRef.current;
    if (!vid || playlist.length === 0) return;

    const tryPlay = async () => {
      try {
        await vid.play();
        // If autoplay worked, try fullscreen silently (may fail without gesture)
        enterFullscreen();
      } catch {
        // Autoplay blocked — show tap overlay
        setNeedsTap(true);
      }
    };

    vid.addEventListener("canplay", () => tryPlay(), { once: true });
    tryPlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.length > 0]);

  const handleTapToStart = async () => {
    setNeedsTap(false);
    await enterFullscreen();
    const vid = activeSlot === "A" ? videoARef.current : videoBRef.current;
    if (vid) {
      vid.muted = true;
      vid.play().catch(() => {});
    }
  };

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      wakeLock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Device registration & heartbeat via secure RPC
  useEffect(() => {
    if (!token) return;

    const fingerprint = getDeviceFingerprint();

    const sendHeartbeat = () => {
      deviceHeartbeat(token, fingerprint, navigator.userAgent).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);

    return () => clearInterval(interval);
  }, [token]);

  const currentVideo = getVideoByOrder(currentIndex);


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center">
        <div>
          <p className="text-xl font-bold mb-2">Erro</p>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  if (playlist.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center">
        <p className="text-white/60">Nenhum vídeo na playlist "{playlistName}"</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <video
        ref={videoARef}
        src={activeSlot === "A" ? currentVideo?.url : undefined}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: opacityA,
          transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
          zIndex: activeSlot === "A" ? 2 : 1,
        }}
        autoPlay
        muted
        playsInline
        onEnded={activeSlot === "A" ? handleVideoEnd : undefined}
        onError={activeSlot === "A" ? () => handleVideoEnd() : undefined}
      />
      <video
        ref={videoBRef}
        src={activeSlot === "B" ? currentVideo?.url : undefined}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: opacityB,
          transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
          zIndex: activeSlot === "B" ? 2 : 1,
        }}
        autoPlay
        muted
        playsInline
        onEnded={activeSlot === "B" ? handleVideoEnd : undefined}
        onError={activeSlot === "B" ? () => handleVideoEnd() : undefined}
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
