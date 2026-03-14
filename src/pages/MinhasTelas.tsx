import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, RefreshCw, MapPin, Clock, Globe, Cpu, Edit2, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeviceRow {
  id: string;
  name: string | null;
  location_label: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean | null;
  last_seen: string | null;
  created_at: string | null;
  playlist_id: string | null;
  playlist_name: string | null;
  is_online: boolean | null;
}

type StatusFilter = "all" | "online" | "offline";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "desconhecido";
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return "há " + mins + " min";
  var hours = Math.floor(mins / 60);
  if (hours < 24) return "há " + hours + "h";
  var days = Math.floor(hours / 24);
  return "há " + days + " dia" + (days > 1 ? "s" : "");
}

function formatUserAgent(ua: string | null): string {
  if (!ua) return "Desconhecido";
  if (ua.indexOf("webOS") !== -1) {
    var match = ua.match(/webOS[./\s]*TV[/-]?(\d+[\d.]*)/i);
    return match ? "LG webOS " + match[1] : "LG webOS TV";
  }
  if (ua.indexOf("Tizen") !== -1) return "Samsung Tizen";
  if (ua.indexOf("Android") !== -1) return "Android";
  if (ua.indexOf("Windows") !== -1) return "Windows";
  if (ua.indexOf("Mac") !== -1) return "macOS";
  if (ua.indexOf("Linux") !== -1) return "Linux";
  return ua.length > 40 ? ua.substring(0, 40) + "…" : ua;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  var d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const MinhasTelas = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editDevice, setEditDevice] = useState<DeviceRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    var { data, error } = await supabase.rpc("get_my_devices");
    if (data) setDevices(data as DeviceRow[]);
    if (error) console.error("get_my_devices error:", error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  var onlineCount = devices.filter(function (d) { return d.is_online; }).length;
  var offlineCount = devices.length - onlineCount;

  var filtered = devices.filter(function (d) {
    if (filter === "online") return d.is_online;
    if (filter === "offline") return !d.is_online;
    return true;
  });

  function openEdit(d: DeviceRow) {
    setEditDevice(d);
    setEditName(d.name || "");
    setEditLabel(d.location_label || "");
    setEditAddress(d.address || "");
  }

  async function handleSave() {
    if (!editDevice) return;
    setSaving(true);
    var { data, error } = await supabase.rpc("update_device_info", {
      p_device_id: editDevice.id,
      p_name: editName || null,
      p_location_label: editLabel || null,
      p_address: editAddress || null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Dispositivo atualizado" });
    setEditDevice(null);
    // Update locally without full refetch
    setDevices(function (prev) {
      return prev.map(function (d) {
        if (d.id !== editDevice.id) return d;
        return { ...d, name: editName || null, location_label: editLabel || null, address: editAddress || null };
      });
    });
  }

  async function handleRemove(deviceId: string) {
    var { error } = await supabase.rpc("remove_device", { p_device_id: deviceId });
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dispositivo removido" });
    setDevices(function (prev) { return prev.filter(function (d) { return d.id !== deviceId; }); });
  }

  function getLocation(d: DeviceRow): string {
    if (d.location_label) return d.location_label;
    var parts = [d.city, d.region].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Localização desconhecida";
  }

  return (
    <AppLayout title="Minhas Telas" subtitle="Gerencie os dispositivos conectados ao seu sistema">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {onlineCount} online · {offlineCount} offline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "online", "offline"] as StatusFilter[]).map(function (s) {
            var labels: Record<StatusFilter, string> = { all: "Todas", online: "Online", offline: "Offline" };
            return (
              <Button
                key={s}
                variant={filter === s ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={function () { setFilter(s); }}
              >
                {labels[s]}
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={fetchDevices}>
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
          <Monitor className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma tela conectada ainda.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Abra o link da playlist em uma TV para registrar automaticamente.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
          <Monitor className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum dispositivo com esse filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(function (d) {
            var online = !!d.is_online;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary/30 hover:shadow-glow"
              >
                {/* Top row: status + name + edit */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={
                        "inline-block w-2.5 h-2.5 rounded-full shrink-0 " +
                        (online ? "bg-green-400 animate-pulse" : "bg-muted-foreground/50")
                      }
                    />
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {d.name || "Sem nome"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={function () { openEdit(d); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!online && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={function () { handleRemove(d.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="mb-3">
                  {online ? (
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 gap-1">
                      <Wifi className="w-3 h-3" /> Online
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                      <WifiOff className="w-3 h-3" /> Offline · {relativeTime(d.last_seen)}
                    </Badge>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {d.playlist_name && (
                    <div className="flex items-center gap-1.5">
                      <Monitor className="w-3 h-3 shrink-0" />
                      <span className="truncate">Playlist: <span className="text-foreground">{d.playlist_name}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{getLocation(d)}</span>
                  </div>
                  {online && d.last_seen && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>Último contato: {relativeTime(d.last_seen)}</span>
                    </div>
                  )}
                  {d.ip_address && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 shrink-0" />
                      <span>IP: {d.ip_address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 shrink-0" />
                    <span>{formatUserAgent(d.user_agent)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={editDevice !== null} onOpenChange={function (open) { if (!open) setEditDevice(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Dispositivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do equipamento</Label>
              <Input
                id="edit-name"
                placeholder="Ex: TV Recepção, Tela Loja 01"
                value={editName}
                onChange={function (e) { setEditName(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Identificação do local</Label>
              <Input
                id="edit-label"
                placeholder="Ex: Loja Centro, Filial Norte"
                value={editLabel}
                onChange={function (e) { setEditLabel(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Endereço completo</Label>
              <Input
                id="edit-address"
                placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                value={editAddress}
                onChange={function (e) { setEditAddress(e.target.value); }}
              />
            </div>

            {/* Read-only info */}
            {editDevice && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Cidade (IP):</span> {[editDevice.city, editDevice.region].filter(Boolean).join(", ") || "—"}</p>
                <p><span className="font-medium text-foreground">IP:</span> {editDevice.ip_address || "—"}</p>
                <p><span className="font-medium text-foreground">Dispositivo:</span> {formatUserAgent(editDevice.user_agent)}</p>
                <p><span className="font-medium text-foreground">Fuso horário:</span> {editDevice.timezone || "—"}</p>
                <p><span className="font-medium text-foreground">Playlist:</span> {editDevice.playlist_name || "—"}</p>
                <p><span className="font-medium text-foreground">Registrado em:</span> {formatDate(editDevice.created_at)}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={function () { setEditDevice(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MinhasTelas;
