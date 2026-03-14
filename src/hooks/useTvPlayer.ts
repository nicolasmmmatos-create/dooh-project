import { useEffect, useState, useCallback, useRef } from "react";
import {
  getPlaylistByToken,
  deviceHeartbeat,
  getDeviceFingerprint,
  getIpLocation,
  type Playlist,
  type Video,
} from "@/lib/supabase-tv";

interface TvPlayerState {
  playlist: Playlist | null;
  videos: Video[];
  loading: boolean;
  error: string | null;
  currentIndex: number;
  goNext: () => void;
  goPrev: () => void;
}

export function useTvPlayer(token: string): TvPlayerState {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchedAtRef = useRef(0);
  const pendingVideosRef = useRef<Video[] | null>(null);
  const playlistRef = useRef<Playlist | null>(null);
  const locationRef = useRef<any>({});

  const cacheKey = `bdp_cache_${token}`;

  const applyFetch = useCallback(
    (result: { playlist: Playlist; videos: Video[]; fetched_at: number }, silent: boolean) => {
      if (result.fetched_at <= fetchedAtRef.current && silent) return;
      fetchedAtRef.current = result.fetched_at;
      playlistRef.current = result.playlist;
      setPlaylist(result.playlist);

      if (silent) {
        // Queue update — will be applied on goNext / video end
        pendingVideosRef.current = result.videos;
      } else {
        setVideos(result.videos);
      }

      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {}
    },
    [cacheKey]
  );

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        const result = await getPlaylistByToken(token);
        if (cancelled) return;
        if ("error" in result) {
          setError(result.error);
        } else {
          applyFetch(result, false);
        }
      } catch {
        // Network error — try cache
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (!cancelled && parsed.playlist) {
              applyFetch(parsed, false);
            }
          } else {
            if (!cancelled) setError("Sem conexão e sem cache disponível");
          }
        } catch {
          if (!cancelled) setError("Erro ao carregar playlist");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Initial heartbeat with location
      try {
        var loc = await getIpLocation();
        locationRef.current = loc;
        await deviceHeartbeat(token, getDeviceFingerprint(), navigator.userAgent, loc);
      } catch {}
    };

    init();
    return () => { cancelled = true; };
  }, [token, cacheKey, applyFetch]);

  // Polling every 5 min
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await getPlaylistByToken(token);
        if (!("error" in result)) {
          applyFetch(result, true);
        }
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, applyFetch]);

  // Heartbeat every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      deviceHeartbeat(token, getDeviceFingerprint(), navigator.userAgent, locationRef.current)
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [token]);

  // Flush pending videos on index change
  const flushPending = useCallback(() => {
    if (pendingVideosRef.current) {
      setVideos(pendingVideosRef.current);
      pendingVideosRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const total = (pendingVideosRef.current !== null && pendingVideosRef.current !== undefined ? pendingVideosRef.current.length : videos.length);
      if (total === 0) return 0;
      const next = prev + 1;
      if (next >= total) {
        if (playlistRef.current && playlistRef.current.loop) {
          flushPending();
          return 0;
        }
        return prev; // stay at last
      }
      flushPending();
      return next;
    });
  }, [videos.length, flushPending]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) {
        const total = videos.length;
        if (playlistRef.current && playlistRef.current.loop && total > 0) return total - 1;
        return 0;
      }
      return prev - 1;
    });
  }, [videos.length]);

  return { playlist, videos, loading, error, currentIndex, goNext, goPrev };
}
