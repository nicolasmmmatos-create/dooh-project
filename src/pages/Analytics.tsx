import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { BarChart3, Play, Clock, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const Analytics = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Placeholder
  const stats: any[] = [];
  const loading = false;
  const chartData = stats.map((s: any) => ({ name: s.playlist_name, plays: s.total_plays }));

  return (
    <AppLayout title="Analytics" subtitle="Métricas de reprodução das suas playlists">
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">De</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Até</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : stats.length === 0 ? (
        <div className="text-center py-20">
          <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum dado disponível. Comece reproduzindo playlists.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-6 shadow-card mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />Reproduções por Playlist
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((s: any) => (
              <div key={s.playlist_id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <h4 className="font-semibold text-foreground mb-3">{s.playlist_name}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Play className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Reproduções:</span>
                    <span className="font-medium text-foreground">{s.total_plays}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Tempo total:</span>
                    <span className="font-medium text-foreground">{Math.round(s.total_duration / 60)}min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Analytics;
