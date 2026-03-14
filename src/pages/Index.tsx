import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { BarChart3, Image, ListVideo, Monitor, Clock, AlertCircle, Bell, Tv, Settings, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAllActiveScreens } from "@/lib/supabase-tv";
import DeviceMap from "@/components/dashboard/DeviceMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const StatCard = ({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: string | number; color: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`rounded-xl border border-border bg-card p-6 shadow-card animate-slide-in transition-all duration-200 ${onClick ? "cursor-pointer hover:border-primary hover:shadow-glow hover:scale-[1.02]" : ""}`}
  >
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  </div>
);

type ActivityFilter = "all" | "errors" | "playlists" | "devices";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  severity: string | null;
  meta: any;
  created_at: string | null;
}

function activityRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return "há " + mins + " min";
  var hours = Math.floor(mins / 60);
  if (hours < 24) return "há " + hours + "h";
  var d = new Date(dateStr);
  return "ontem às " + d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function getActivityIcon(type: string, severity: string | null) {
  if (severity === "error") return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (severity === "warning") return <Bell className="w-4 h-4 text-warning" />;
  if (type === "playlist_created") return <ListVideo className="w-4 h-4 text-success" />;
  if (type === "playlist_updated") return <Settings className="w-4 h-4 text-primary" />;
  if (type === "device_connected") return <Tv className="w-4 h-4 text-success" />;
  if (type === "device_lost") return <Bell className="w-4 h-4 text-warning" />;
  return <BarChart3 className="w-4 h-4 text-primary" />;
}

function getActivityBadge(type: string): string {
  var map: Record<string, string> = {
    player_error: "ERRO PLAYER",
    playlist_created: "PLAYLIST",
    playlist_updated: "PLAYLIST",
    device_connected: "DISPOSITIVO",
    device_lost: "DISPOSITIVO",
    schedule_triggered: "AGENDAMENTO",
  };
  return map[type] || type.toUpperCase();
}

const Index = () => {
  const navigate = useNavigate();
  const [mediaCount, setMediaCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [activeScreens, setActiveScreens] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const fetchActivities = useCallback(async () => {
    // "errors" maps to a single type; others need multiple types → fetch all, filter client-side
    var singleType: string | undefined;
    if (activityFilter === "errors") singleType = "player_error";

    var params: { p_limit: number; p_type?: string } = { p_limit: 40 };
    if (singleType) params.p_type = singleType;

    var { data } = await supabase.rpc("get_recent_activity", params);
    if (!data) return;

    var items = data as ActivityItem[];

    if (activityFilter === "playlists") {
      items = items.filter(a => a.type === "playlist_created" || a.type === "playlist_updated");
    } else if (activityFilter === "devices") {
      items = items.filter(a => a.type === "device_connected" || a.type === "device_lost");
    }

    setActivities(items.slice(0, 20));
  }, [activityFilter]);

  useEffect(() => {
    const fetchCounts = async () => {
      const [{ count: mCount }, { count: pCount }, screens] = await Promise.all([
        supabase.from("videos").select("*", { count: "exact", head: true }),
        supabase.from("playlists").select("*", { count: "exact", head: true }),
        getAllActiveScreens(),
      ]);
      setMediaCount(mCount ?? 0);
      setPlaylistCount(pCount ?? 0);
      setActiveScreens(Object.values(screens).reduce((a, b) => a + b, 0));
    };
    fetchCounts();
    const interval = setInterval(() => {
      getAllActiveScreens().then((s) => setActiveScreens(Object.values(s).reduce((a, b) => a + b, 0))).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchActivities();
    var interval = setInterval(fetchActivities, 30000);
    return function () { clearInterval(interval); };
  }, [fetchActivities]);

  var filterButtons: { key: ActivityFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "errors", label: "Erros" },
    { key: "playlists", label: "Playlists" },
    { key: "devices", label: "Dispositivos" },
  ];

  return (
    <AppLayout title="Dashboard" subtitle="Visão geral do seu sistema de sinalização digital">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Image} label="Mídias" value={mediaCount} color="gradient-primary text-primary-foreground" onClick={() => navigate("/media")} />
        <StatCard icon={ListVideo} label="Playlists" value={playlistCount} color="bg-secondary text-primary" onClick={() => navigate("/playlists")} />
        <StatCard icon={Monitor} label="Telas Ativas" value={activeScreens} color={activeScreens > 0 ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"} onClick={() => navigate("/minhas-telas")} />
        <StatCard icon={Clock} label="Status" value="Online" color="bg-success/20 text-success" />
      </div>

      {/* Device Map */}
      <div className="mb-8">
        <DeviceMap />
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
          </div>
          <div className="flex gap-1.5">
            {filterButtons.map(function (fb) {
              return (
                <Button
                  key={fb.key}
                  variant={activityFilter === fb.key ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={function () { setActivityFilter(fb.key); }}
                >
                  {fb.label}
                </Button>
              );
            })}
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhuma atividade ainda.
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              As ações do sistema aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {activities.map(function (a) {
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                    {getActivityIcon(a.type, a.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                        {getActivityBadge(a.type)}
                      </Badge>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {activityRelativeTime(a.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
