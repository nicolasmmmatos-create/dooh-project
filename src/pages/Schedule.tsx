import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, Clock, Loader2, Film, ListVideo, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const DAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

interface Schedule {
  id: string;
  target_type: "video" | "playlist";
  target_id: string;
  target_name: string;
  label: string | null;
  specific_date: string | null;
  days_of_week: number[];
  time_start: string;
  time_end: string;
  is_active: boolean;
  created_at: string;
}

interface Playlist { id: string; name: string; }
interface Video { id: string; filename: string; playlist_name: string; }

const Schedule = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [targetType, setTargetType] = useState<"video" | "playlist">("playlist");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [useSpecificDate, setUseSpecificDate] = useState(false);
  const [specificDate, setSpecificDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([0,1,2,3,4,5,6]));
  const [timeStart, setTimeStart] = useState("08:00");
  const [timeEnd, setTimeEnd] = useState("18:00");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [schedulesRes, playlistsRes, videosRes] = await Promise.all([
      supabase.rpc("get_my_schedules"),
      supabase.from("playlists").select("id, name").order("name"),
      supabase.from("videos").select("id, filename, playlist_id, playlists(name)").not("playlist_id", "is", null),
    ]);

    if (schedulesRes.data) setSchedules(schedulesRes.data as Schedule[]);
    if (playlistsRes.data) setPlaylists(playlistsRes.data);
    if (videosRes.data) {
      setVideos(videosRes.data.map((v: any) => ({
        id: v.id,
        filename: v.filename.replace(/\.[^/.]+$/, ""),
        playlist_name: v.playlists?.name || "",
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setTargetType("playlist");
    setTargetId("");
    setLabel("");
    setUseSpecificDate(false);
    setSpecificDate("");
    setSelectedDays(new Set([0,1,2,3,4,5,6]));
    setTimeStart("08:00");
    setTimeEnd("18:00");
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!targetId) {
      toast({ title: "Selecione um alvo", variant: "destructive" });
      return;
    }
    if (useSpecificDate && !specificDate) {
      toast({ title: "Informe a data específica", variant: "destructive" });
      return;
    }
    if (!useSpecificDate && selectedDays.size === 0) {
      toast({ title: "Selecione ao menos um dia da semana", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("schedules").insert({
      user_id: userData.user?.id,
      target_type: targetType,
      target_id: targetId,
      label: label.trim() || null,
      specific_date: useSpecificDate ? specificDate : null,
      days_of_week: useSpecificDate ? [] : Array.from(selectedDays).sort(),
      time_start: timeStart,
      time_end: timeEnd,
    });
    if (error) {
      toast({ title: "Erro ao criar agendamento", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento criado!" });
      setCreateOpen(false);
      resetForm();
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento removido" });
      fetchData();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
    const { error } = await supabase.from("schedules").update({ is_active: !current }).eq("id", id);
    if (error) {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: current } : s));
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const formatScheduleTime = (s: Schedule) => {
    const timeStr = `${s.time_start.slice(0,5)} → ${s.time_end.slice(0,5)}`;
    if (s.specific_date) {
      return `${new Date(s.specific_date + "T12:00:00").toLocaleDateString("pt-BR")} · ${timeStr}`;
    }
    const dayStr = s.days_of_week.map(d => DAY_NAMES[d]).join(", ");
    return `${dayStr} · ${timeStr}`;
  };

  return (
    <AppLayout
      title="Agendamento"
      subtitle="Programe mídias e playlists para ativação automática"
      actions={
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum agendamento criado.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Crie um agendamento para ativar/desativar mídias e playlists automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className={cn(
              "rounded-xl border bg-card p-5 flex items-center justify-between shadow-card transition-opacity",
              !s.is_active && "opacity-50"
            )}>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-3 h-3 rounded-full shrink-0 ${s.is_active ? "bg-success animate-pulse-glow" : "bg-muted-foreground"}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.target_type === "playlist"
                      ? <ListVideo className="w-4 h-4 text-primary shrink-0" />
                      : <Film className="w-4 h-4 text-primary shrink-0" />
                    }
                    <p className="font-semibold text-foreground truncate">{s.target_name || "—"}</p>
                    {s.label && <span className="text-xs text-muted-foreground">· {s.label}</span>}
                  </div>

                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground flex-wrap">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatScheduleTime(s)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleToggleActive(s.id, s.is_active)}
                  title={s.is_active ? "Desativar" : "Ativar"}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {s.is_active
                    ? <ToggleRight className="w-5 h-5 text-primary" />
                    : <ToggleLeft className="w-5 h-5" />
                  }
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) resetForm(); setCreateOpen(v); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">

            {/* Tipo de alvo */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Tipo de alvo</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={targetType === "playlist" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setTargetType("playlist"); setTargetId(""); }}
                >
                  Playlist
                </Button>
                <Button
                  type="button"
                  variant={targetType === "video" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setTargetType("video"); setTargetId(""); }}
                >
                  Mídia
                </Button>
              </div>
            </div>

            {/* Seleção do alvo */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                {targetType === "playlist" ? "Playlist" : "Mídia"}
              </label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {targetType === "playlist"
                    ? playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                    : videos.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.filename}
                          {v.playlist_name && <span className="text-xs text-muted-foreground ml-2">({v.playlist_name})</span>}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Label opcional */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Promoção de verão"
                className="bg-muted border-border"
              />
            </div>

            {/* Modo: dias da semana ou data específica */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {useSpecificDate ? "Data específica" : "Dias da semana"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {useSpecificDate ? "Agendamento para uma data única" : "Repete nos dias selecionados"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUseSpecificDate(v => !v)}
                className={cn(
                  "relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none",
                  useSpecificDate ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-foreground shadow-md transition-transform duration-300",
                  useSpecificDate ? "translate-x-7" : "translate-x-0"
                )} />
              </button>
            </div>

            {useSpecificDate ? (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Data</label>
                <Input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} className="bg-muted border-border" />
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Dias da semana</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-semibold transition-all duration-150 border",
                        selectedDays.has(d.value)
                          ? "gradient-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário início</label>
                <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário fim</label>
                <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="bg-muted border-border" />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Schedule;
