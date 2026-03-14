import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ListVideo, Plus, Loader2 } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
}

interface AddToPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoIds: string[];
  onDone: () => void;
}

const AddToPlaylistDialog = ({ open, onOpenChange, videoIds, onDone }: AddToPlaylistDialogProps) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("playlists")
      .select("id, name")
      .order("name")
      .then(({ data, error }) => {
        if (!error) setPlaylists(data || []);
        setLoading(false);
      });
  }, [open]);

  const assignToPlaylist = async (playlistId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("videos")
      .update({ playlist_id: playlistId })
      .in("id", videoIds);

    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${videoIds.length} mídia(s) adicionada(s) à playlist` });
      onDone();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleCreateAndAssign = async () => {
    if (!newName.trim()) return;
    setSaving(true);

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast({ title: "Não autenticado", variant: "destructive" });
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("playlists")
      .insert({ name: newName.trim(), user_id: userId })
      .select("id")
      .single();

    if (error || !data) {
      toast({ title: "Erro ao criar playlist", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await assignToPlaylist(data.id);
    setNewName("");
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adicionar à Playlist</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {playlists.length === 0 && !creating && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma playlist encontrada.
              </p>
            )}
            {playlists.map((pl) => (
              <button
                key={pl.id}
                disabled={saving}
                onClick={() => assignToPlaylist(pl.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
              >
                <ListVideo className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{pl.name}</span>
              </button>
            ))}
          </div>
        )}

        {creating ? (
          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder="Nome da playlist..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-background border-border"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateAndAssign()}
            />
            <Button size="sm" onClick={handleCreateAndAssign} disabled={saving || !newName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(""); }}>
              Cancelar
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Playlist
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddToPlaylistDialog;
