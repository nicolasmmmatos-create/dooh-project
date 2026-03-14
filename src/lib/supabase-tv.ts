import { supabase } from "@/integrations/supabase/client";

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  loop: boolean;
  transition_type: string | null;
  transition_duration: number | null;
  settings: Record<string, unknown> | null;
}

export interface Video {
  id: string;
  filename: string;
  storage_path: string;
  duration: number | null;
  order_index: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  title: string | null;
  page_number: number;
}

export async function getOrCreatePlaylistToken(playlistId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const { data, error } = await supabase.rpc("get_or_create_playlist_token", {
    p_playlist_id: playlistId,
  });
  if (error) throw error;
  return data as string;
}

export async function getPlaylistByToken(
  token: string
): Promise<{ playlist: Playlist; videos: Video[]; fetched_at: number } | { error: string }> {
  const { data, error } = await supabase.rpc("get_playlist_by_token", {
    p_token: token,
  });
  if (error) throw error;
  return data as any;
}

export async function getIpLocation() {
  try {
    var res = await fetch('https://ipapi.co/json/')
    var data = await res.json()
    return {
      city:      data.city      || null,
      region:    data.region    || null,
      country:   data.country   || null,
      latitude:  data.latitude  || null,
      longitude: data.longitude || null,
      timezone:  data.timezone  || null,
    }
  } catch (e) {
    return {}
  }
}

export async function deviceHeartbeat(
  token: string,
  fingerprint: string,
  userAgent: string,
  location?: {
    city?: string | null
    region?: string | null
    country?: string | null
    latitude?: number | null
    longitude?: number | null
    timezone?: string | null
  }
) {
  try {
    var params: any = {
      p_token: token,
      p_device_fingerprint: fingerprint,
      p_user_agent: userAgent,
    }
    if (location) {
      if (location.city)      params.p_city      = location.city
      if (location.region)    params.p_region    = location.region
      if (location.country)   params.p_country   = location.country
      if (location.latitude)  params.p_latitude  = location.latitude
      if (location.longitude) params.p_longitude = location.longitude
      if (location.timezone)  params.p_timezone  = location.timezone
    }
    var result = await supabase.rpc('device_heartbeat', params)
    return (result.data as any) || { ok: false }
  } catch (e) {
    return { ok: false }
  }
}

export async function getAllActiveScreens(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_all_active_screens");
  if (error || !data) return {};
  const result: Record<string, number> = {};
  for (const row of data as any[]) {
    result[row.playlist_id] = Number(row.active_count);
  }
  return result;
}

export function getDeviceFingerprint(): string {
  var fp = localStorage.getItem("bdp_device_fp");
  if (!fp) {
    fp = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem("bdp_device_fp", fp);
  }
  return fp;
}
