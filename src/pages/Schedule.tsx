import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

const Schedule = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [useWeekdays, setUseWeekdays] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    playlist_id: "",
    start_date: "",
    end_date: "",
    start_time: "00:00",
    end_time: "23:59",
  });
  const { toast } = useToast();

  // Placeholder
  const schedules: any[] = [];
  const playlists: any[] = [];
  const loading = false;

  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const resetForm = () => {
    setForm({ playlist_id: "", start_date: "", end_date: "", start_time: "00:00", end_time: "23:59" });
    setUseWeekdays(false);
    setSelectedDays(new Set());
  };

  return (
    <AppLayout
      title="Agendamento"
      subtitle="Programe playlists para exibição automática"
      actions={
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />Novo Agendamento
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum agendamento criado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s: any) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-5 flex items-center justify-between shadow-card">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${s.is_active ? "bg-success animate-pulse-glow" : "bg-muted-foreground"}`} />
                <div>
                  <p className="font-semibold text-foreground">{s.playlist_name}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{s.start_date} → {s.end_date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.start_time} - {s.end_time}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={v => { if (!v) resetForm(); setCreateOpen(v); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Playlist</label>
              <select
                value={form.playlist_id}
                onChange={e => setForm(f => ({ ...f, playlist_id: e.target.value }))}
                className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecionar...</option>
                {playlists.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {useWeekdays ? "Dias da semana" : "Período por data"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {useWeekdays ? "Selecione quais dias da semana" : "Defina data início e fim"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseWeekdays(v => !v)}
                className={cn(
                  "relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none",
                  useWeekdays ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-foreground shadow-md transition-transform duration-300",
                    useWeekdays ? "translate-x-7" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {useWeekdays ? (
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
                          ? "gradient-primary text-primary-foreground border-primary shadow-glow"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Data início</label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Data fim</label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-muted border-border" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário início</label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário fim</label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="bg-muted border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="gradient-primary text-primary-foreground">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Schedule;
