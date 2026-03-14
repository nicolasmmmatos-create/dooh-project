import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreatePlaylistToken, getAllActiveScreens } from "@/lib/supabase-tv";
import VideoUpload from "@/components/VideoUpload";
import PlaylistMediaPicker from "@/components/PlaylistMediaPicker";
import PlaylistItemsList from "@/components/PlaylistItemsList";
import PlaylistThumbnail from "@/components/PlaylistThumbnail";
import {
  Plus, Trash2, Edit, Link2, ListVideo, Grid3X3, List, Loader2, Check, Monitor, Library, Clock, ExternalLink
} from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string | null;
  item_count?: number;
  device_count?: number;
  total_duration?: number;
  video_urls?: string[];
  page_count?: number;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

const Playlists = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [editPlaylistVideoIds, setEditPlaylistVideoIds] = useState<string[]>([]);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [activeScreens, setActiveScreens] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Poll active screens every 60s
  useEffect(() => {
    const fetchScreens = () => getAllActiveScreens().then(setActiveScreens).catch(() => {});
    fetchScreens();
    const interval = setInterval(fetchScreens, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchPlaylists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar playlists", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const playlistsWithData = await Promise.all(
      (data || []).map(async (p) => {
        const [videosRes, devicesRes] = await Promise.all([
          supabase.from("videos").select("id, storage_path, duration, page_number").eq("playlist_id", p.id).order("order_index"),
          supabase.from("devices").select("id", { count: "exact", head: true }).eq("playlist_id", p.id).gte("last_seen", new Date(Date.now() - 2 * 60 * 1000).toISOString()),
        ]);

        const videos = videosRes.data || [];
        const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
        const pageCount = new Set(videos.map((v) => v.page_number || 1)).size;

        const videoUrls = await Promise.all(
          videos.map(async (v) => {
            const { data: urlData } = await supabase.storage.from("videos").createSignedUrl(v.storage_path, 3600);
            return urlData?.signedUrl || "";
          })
        );

        return {
          ...p,
          item_count: videos.length,
          device_count: devicesRes.count ?? 0,
          total_duration: totalDuration,
          video_urls: videoUrls,
          page_count: pageCount || 1,
        };
      })
    );

    setPlaylists(playlistsWithData);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("playlists").insert({ name: newName.trim(), user_id: userData.user.id });
    if (error) {
      toast({ title: "Erro ao criar playlist", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Playlist criada com sucesso!" });
      setNewName("");
      setCreateOpen(false);
      fetchPlaylists();
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editName.trim() || !selectedPlaylist) return;
    setSaving(true);
    const { error } = await supabase
      .from("playlists")
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq("id", selectedPlaylist.id);
    if (error) {
      toast({ title: "Erro ao editar playlist", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Playlist atualizada!" });
      setEditOpen(false);
      setSelectedPlaylist(null);
      fetchPlaylists();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedPlaylist) return;
    setSaving(true);
    const { error } = await supabase.from("playlists").delete().eq("id", selectedPlaylist.id);
    if (error) {
      toast({ title: "Erro ao excluir playlist", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Playlist excluída!" });
      setDeleteOpen(false);
      setSelectedPlaylist(null);
      fetchPlaylists();
    }
    setSaving(false);
  };

  const handleGenerateLink = async (playlist: Playlist) => {
    try {
      const token = await getOrCreatePlaylistToken(playlist.id);
      const url = `${window.location.origin}/tv/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(playlist.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenPlayer = async (playlist: Playlist) => {
    try {
      const token = await getOrCreatePlaylistToken(playlist.id);
      window.open(`${window.location.origin}/tv/${token}`, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = async (p: Playlist) => {
    setSelectedPlaylist(p);
    setEditName(p.name);
    setEditOpen(true);
    const { data } = await supabase.from("videos").select("id").eq("playlist_id", p.id);
    setEditPlaylistVideoIds((data || []).map((v) => v.id));
  };

  const openDelete = (p: Playlist) => {
    setSelectedPlaylist(p);
    setDeleteOpen(true);
  };

  return (
    <AppLayout
      title="Playlists"
      subtitle={`${playlists.length} playlist(s)`}
      actions={
        <Button onClick={() => setCreateOpen(true)} className="gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />Nova Playlist
        </Button>
      }
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20">
          <ListVideo className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma playlist criada ainda.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card shadow-card hover:shadow-glow transition-all overflow-hidden">
              {/* Thumbnail */}
              <PlaylistThumbnail videoUrls={p.video_urls || []} />

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{p.item_count} mídia(s)</span>
                      <span className="text-xs text-muted-foreground">{p.page_count || 1} pág.</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDuration(p.total_duration || 0)}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const count = activeScreens[p.id] ?? 0;
                    return (
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${count > 0 ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        <Monitor className="w-3 h-3" />
                        <span>{count}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                    <Edit className="w-3 h-3 mr-1" />Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleGenerateLink(p)}>
                    {copiedId === p.id ? <Check className="w-3 h-3 mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
                    Link
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => handleOpenPlayer(p)} title="Abrir player">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => openDelete(p)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0">
                  <PlaylistThumbnail videoUrls={p.video_urls || []} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    {p.item_count} mídia(s) · {p.page_count || 1} pág. · {p.device_count} disp.
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(p.total_duration || 0)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Edit className="w-3 h-3" /></Button>
                <Button variant="outline" size="sm" onClick={() => handleGenerateLink(p)}>
                  {copiedId === p.id ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenPlayer(p)} title="Abrir player"><ExternalLink className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openDelete(p)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Nova Playlist</DialogTitle></DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da playlist" className="bg-muted border-border" />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-foreground">Editar Playlist</DialogTitle></DialogHeader>
          <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome da playlist" className="bg-muted border-border" />
          {selectedPlaylist && (
            <div className="space-y-3 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Mídias na Playlist</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMediaPickerOpen(true)}>
                    <Library className="w-3 h-3 mr-1" />Biblioteca
                  </Button>
                </div>
              </div>
              <PlaylistItemsList
                playlistId={selectedPlaylist.id}
                onPageChange={(page) => setCurrentPageNumber(page)}
                onChanged={() => {
                  fetchPlaylists();
                  supabase.from("videos").select("id").eq("playlist_id", selectedPlaylist.id).then(({ data }) => {
                    setEditPlaylistVideoIds((data || []).map((v) => v.id));
                  });
                }}
              />
              {/* Upload removido — use a Biblioteca para adicionar mídias */}
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Picker */}
      {selectedPlaylist && (
        <PlaylistMediaPicker
          open={mediaPickerOpen}
          onOpenChange={setMediaPickerOpen}
          playlistId={selectedPlaylist.id}
          existingVideoIds={editPlaylistVideoIds}
          pageNumber={currentPageNumber}
          onDone={() => {
            fetchPlaylists();
            supabase.from("videos").select("id").eq("playlist_id", selectedPlaylist.id).then(({ data }) => {
              setEditPlaylistVideoIds((data || []).map((v) => v.id));
            });
          }}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Excluir Playlist</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir "<span className="text-foreground font-medium">{selectedPlaylist?.name}</span>"? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Playlists;
