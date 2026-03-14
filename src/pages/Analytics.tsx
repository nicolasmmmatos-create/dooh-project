import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart3, Play, Clock, Monitor, Loader2, TrendingUp, Film } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PlaylistStat {
  playlist_id: string;
  playlist_name: string;
  total_plays: number;
  total_duration: number;
  unique_devices: number;
  last_played_at: string | null;
}

interface VideoStat {
  video_id: string;
  video_name: string;
  playlist_id: string;
  playlist_name: string;
  total_plays: number;
  total_duration: number;
  unique_devices: number;
  last_played_at: string | null;
}

type TabType = "playlist" | "video";

const Analytics = () => {
  const [tab, setTab] = useState<TabType>("playlist");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [playlistStats, setPlaylistStats] = useState<PlaylistStat[]>([]);
  const [videoStats, setVideoStats] = useState<VideoStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const params = {
      p_start_date: new Date(startDate).toISOString(),
      p_end_date: new Date(endDate + "T23:59:59").toISOString(),
    };

    const [playlistRes, videoRes] = await Promise.all([
      supabase.rpc("get_analytics_summary", params),
      supabase.rpc("get_analytics_by_video", params),
    ]);

    if (playlistRes.error) {
      toast({ title: "Erro ao carregar analytics", description: playlistRes.error.message, variant: "destructive" });
    } else {
      setPlaylistStats((playlistRes.data || []) as PlaylistStat[]);
    }

    if (videoRes.error) {
      toast({ title: "Erro ao carregar analytics por mídia", description: videoRes.error.message, variant: "destructive" });
    } else {
      setVideoStats((videoRes.data || []) as VideoStat[]);
    }

    setLoading(false);
  }, [startDate, endDate, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const currentStats = tab === "playlist" ? playlistStats : videoStats;
  const totalPlays = currentStats.reduce((acc, s) => acc + s.total_plays, 0);
  const totalMinutes = currentStats.reduce((acc, s) => acc + s.total_duration, 0);
  const totalDevices = tab === "playlist"
    ? playlistStats.reduce((acc, s) => acc + s.unique_devices, 0)
    : new Set(videoStats.flatMap(s => s.unique_devices)).size;

  const chartData = tab === "playlist"
    ? playlistStats.map(s => ({ name: s.playlist_name, plays: s.total_plays }))
    : videoStats.slice(0, 10).map(s => ({ name: s.video_name.replace(/\.[^/.]+$/, ""), plays: s.total_plays }));

  const hasData = currentStats.some(s => s.total_plays > 0);

  return (
    <AppLayout title="Analytics" subtitle="Métricas de reprodução das suas playlists">
      {/* Filtro de datas */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">De</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-card border-border w-40 [color-scheme:dark]" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Até</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-card border-border w-40 [color-scheme:dark]" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={tab === "playlist" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("playlist")}
          className="gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Por Playlist
        </Button>
        <Button
          variant={tab === "video" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("video")}
          className="gap-2"
        >
          <Film className="w-4 h-4" />
          Por Mídia
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Total de reproduções</div>
              <div className="text-2xl font-bold text-foreground">{totalPlays.toLocaleString("pt-BR")}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Tempo total reproduzido</div>
              <div className="text-2xl font-bold text-foreground">{Math.round(totalMinutes / 60)}min</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Dispositivos únicos</div>
              <div className="text-2xl font-bold text-foreground">{totalDevices}</div>
            </div>
          </div>

          {!hasData ? (
            <div className="text-center py-16 rounded-xl border border-border bg-card">
              <TrendingUp className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Nenhuma reprodução no período selecionado.</p>
              <p className="text-sm text-muted-foreground mt-1">Os dados aparecem assim que uma TV reproduzir uma playlist.</p>
            </div>
          ) : (
            <>
              {/* Gráfico */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-card mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {tab === "playlist" ? "Reproduções por Playlist" : "Top 10 Mídias mais reproduzidas"}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" }}
                      />
                      <Bar dataKey="plays" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela detalhada */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-semibold text-muted-foreground">{tab === "playlist" ? "Playlist" : "Mídia"}</th>
                      {tab === "video" && (
                        <th className="text-left p-3 font-semibold text-muted-foreground">Playlist</th>
                      )}
                      <th className="text-left p-3 font-semibold text-muted-foreground">Reproduções</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Tempo total</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Dispositivos</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Última vez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === "playlist"
                      ? playlistStats.map(s => (
                          <tr key={s.playlist_id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-medium text-foreground">{s.playlist_name}</td>
                            <td className="p-3 text-foreground">{s.total_plays.toLocaleString("pt-BR")}</td>
                            <td className="p-3 text-foreground">{Math.round(s.total_duration / 60)}min</td>
                            <td className="p-3 text-foreground">{s.unique_devices}</td>
                            <td className="p-3 text-muted-foreground">
                              {s.last_played_at ? new Date(s.last_played_at).toLocaleDateString("pt-BR") : "—"}
                            </td>
                          </tr>
                        ))
                      : videoStats.map(s => (
                          <tr key={s.video_id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-medium text-foreground">{s.video_name}</td>
                            <td className="p-3 text-muted-foreground">{s.playlist_name}</td>
                            <td className="p-3 text-foreground">{s.total_plays.toLocaleString("pt-BR")}</td>
                            <td className="p-3 text-foreground">{Math.round(s.total_duration / 60)}min</td>
                            <td className="p-3 text-foreground">{s.unique_devices}</td>
                            <td className="p-3 text-muted-foreground">
                              {s.last_played_at ? new Date(s.last_played_at).toLocaleDateString("pt-BR") : "—"}
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default Analytics;