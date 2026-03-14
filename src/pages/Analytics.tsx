import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { BarChart3, Play, Clock, Monitor, Loader2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsStat {
  playlist_id: string;
  playlist_name: string;
  total_plays: number;
  total_duration: number;
  unique_devices: number;
  last_played_at: string | null;
}

const Analytics = () => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_analytics_summary", {
      p_start_date: new Date(startDate).toISOString(),
      p_end_date: new Date(endDate + "T23:59:59").toISOString(),
    });
    if (error) {
      toast({ title: "Erro ao carregar analytics", description: error.message, variant: "destructive" });
    } else {
      setStats((data || []) as AnalyticsStat[]);
    }
    setLoading(false);
  }, [startDate, endDate, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const totalPlays = stats.reduce((acc, s) => acc + s.total_plays, 0);
  const totalMinutes = stats.reduce((acc, s) => acc + s.total_duration, 0);
  const totalDevices = stats.reduce((acc, s) => acc + s.unique_devices, 0);
  const chartData = stats.map((s) => ({ name: s.playlist_name, plays: s.total_plays }));

  return (
    <AppLayout title="Analytics" subtitle="Métricas de reprodução das suas playlists">
      {/* Filtro de datas */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">De</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Até</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {totalPlays.toLocaleString("pt-BR")}
              </div>
              <div className="text-sm text-muted-foreground">Total de reproduções</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(totalMinutes / 60)}min
              </div>
              <div className="text-sm text-muted-foreground">Tempo total reproduzido</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {totalDevices}
              </div>
              <div className="text-sm text-muted-foreground">Dispositivos únicos</div>
            </div>
          </div>

          {stats.every(s => s.total_plays === 0) ? (
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
                  Reproduções por Playlist
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

              {/* Cards por playlist */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((s) => (
                  <div key={s.playlist_id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <h4 className="font-semibold text-foreground mb-3">{s.playlist_name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Play className="w-4 h-4 text-primary" />
                          Reproduções:
                        </span>
                        <span className="font-medium text-foreground">{s.total_plays.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-4 h-4 text-primary" />
                          Tempo total:
                        </span>
                        <span className="font-medium text-foreground">{Math.round(s.total_duration / 60)}min</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Monitor className="w-4 h-4 text-primary" />
                          Dispositivos:
                        </span>
                        <span className="font-medium text-foreground">{s.unique_devices}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default Analytics;