import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Check, AlertTriangle } from "lucide-react";

interface MediaItem {
  id: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  url: string;
}

interface PlaylistMediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  existingVideoIds: string[];
  pageNumber: number;
  onDone: () => void;
}

const PlaylistMediaPicker = ({ open, onOpenChange, playlistId, existingVideoIds, pageNumber, onDone }: PlaylistMediaPickerProps) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setDuplicateIds(new Set());
    setSearchTerm("");
    setLoading(true);

    supabase
      .from("videos")
      .select("id, filename, storage_path, file_size")
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          toast({ title: "Erro ao carregar mídias", description: error.message, variant: "destructive" });
        } else {
          const items = await Promise.all(
            (data || []).map(async (v) => {
              const { data: urlData } = await supabase.storage.from("videos").createSignedUrl(v.storage_path, 3600);
              return { ...v, url: urlData?.signedUrl || "" };
            })
          );
          setMedia(items);
        }
        setLoading(false);
      });
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDuplicateIds((d) => { const nd = new Set(d); nd.delete(id); return nd; });
      } else {
        next.add(id);
        if (existingVideoIds.includes(id)) {
          setDuplicateIds((d) => new Set(d).add(id));
        }
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);

    const { error } = await supabase
      .from("videos")
      .update({ playlist_id: playlistId, page_number: pageNumber })
      .in("id", Array.from(selectedIds));

    if (error) {
      toast({ title: "Erro ao adicionar mídias", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${selectedIds.size} mídia(s) adicionada(s) à página ${pageNumber}` });
      onDone();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const filtered = media.filter((m) =>
    m.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Adicionar Mídias — Página {pageNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mídias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>

        {duplicateIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{duplicateIds.size} mídia(s) já presente(s) nesta playlist (qualquer página). Serão mantidas.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mídia encontrada.</p>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isDuplicate = isSelected && existingVideoIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.filename}</p>
                    {item.file_size && (
                      <p className="text-xs text-muted-foreground">{(item.file_size / 1024 / 1024).toFixed(1)} MB</p>
                    )}
                  </div>
                  {isDuplicate && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 shrink-0">Duplicada</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saving || selectedIds.size === 0} className="gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Adicionar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlaylistMediaPicker;
