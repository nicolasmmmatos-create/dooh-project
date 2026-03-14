import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Trash2, Grid3X3, List, Search, Image as ImageIcon, Loader2, ListVideo
} from "lucide-react";
import MediaCard from "@/components/MediaCard";
import AddToPlaylistDialog from "@/components/AddToPlaylistDialog";
import UploadDialog from "@/components/UploadDialog";

interface MediaItem {
  id: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  created_at: string | null;
  playlist_id: string | null;
  url: string;
}

const MediaLibrary = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const { toast } = useToast();

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [renameItem, setRenameItem] = useState<MediaItem | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const fetchMedia = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar mídias", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const items: MediaItem[] = (data || []).map((v) => ({
      ...v,
      url: `https://qbslxssxkxgugwkjnlqu.supabase.co/storage/v1/object/public/videos/${v.storage_path}`,
    }));

    setMedia(items);
    setLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("video/") && !file.type.startsWith("image/") && file.name.toLowerCase().indexOf(".mov") === -1) {
        toast({ title: "Formato inválido", description: `"${file.name}" não é um vídeo ou imagem.`, variant: "destructive" });
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `"${file.name}" excede 100MB.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setPendingUploadFiles(validFiles);
      setUploadDialogOpen(true);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);

    try {
      const toDelete = media.filter((m) => selectedIds.has(m.id));
      const paths = toDelete.map((m) => m.storage_path);
      await supabase.storage.from("videos").remove(paths);

      const { error } = await supabase
        .from("videos")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast({ title: `${selectedIds.size} arquivo(s) excluído(s)` });
      setSelectedIds(new Set());
      fetchMedia();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!renameItem || !renamingValue.trim()) return;
    setRenaming(true);
    const ext = renameItem.filename.includes(".") ? "." + renameItem.filename.split(".").pop() : "";
    const newName = renamingValue.trim().replace(/\.[^/.]+$/, "") + ext;
    const { error } = await supabase
      .from("videos")
      .update({ filename: newName })
      .eq("id", renameItem.id);
    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mídia renomeada com sucesso" });
      setRenameItem(null);
      fetchMedia();
    }
    setRenaming(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = media.filter((m) =>
    m.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout
      title="Biblioteca de Mídias"
      subtitle={`${media.length} arquivo(s)`}
      actions={
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="video/*,video/quicktime,.mov,image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            className="gradient-primary text-primary-foreground"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar mídias..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-9"
          onClick={() => {
            if (selectedIds.size === filtered.length && filtered.length > 0) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(filtered.map((m) => m.id)));
            }
          }}
        >
          {selectedIds.size === filtered.length && filtered.length > 0 ? "Desmarcar todas" : "Selecionar todas"}
        </Button>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado(s)</span>
            <Button size="sm" onClick={() => setPlaylistDialogOpen(true)}>
              <ListVideo className="w-4 h-4 mr-1" />
              Playlist
            </Button>
            {selectedIds.size === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const item = media.find((m) => selectedIds.has(m.id));
                  if (item) {
                    setRenameItem(item);
                    setRenamingValue(item.filename.replace(/\.[^/.]+$/, ""));
                  }
                }}
              >
                Renomear
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Excluir
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma mídia encontrada. Faça upload para começar.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <MediaCard
              key={item.id}
              url={item.url}
              filename={item.filename}
              fileSize={item.file_size}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onPreview={() => setPreviewMedia(item)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 w-8"></th>
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">Nome</th>
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">Tamanho</th>
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setPreviewMedia(item)}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-primary" />
                  </td>
                  <td className="p-3 text-sm font-medium text-foreground">{item.filename}</td>
                  <td className="p-3 text-sm text-muted-foreground">{item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(1)}MB` : "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">{previewMedia?.filename}</DialogTitle>
          </DialogHeader>
          {previewMedia && (
            <div className="aspect-video bg-background rounded-lg overflow-hidden">
              <video src={previewMedia.url} controls autoPlay className="w-full h-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        files={pendingUploadFiles}
        onComplete={fetchMedia}
      />

      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Renomear mídia</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <Input
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              placeholder="Novo nome..."
              className="bg-background border-border"
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
              <Button onClick={handleRename} disabled={renaming || !renamingValue.trim()}>
                {renaming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddToPlaylistDialog
        open={playlistDialogOpen}
        onOpenChange={setPlaylistDialogOpen}
        videoIds={Array.from(selectedIds)}
        onDone={() => {
          setSelectedIds(new Set());
          fetchMedia();
        }}
      />
    </AppLayout>
  );
};

export default MediaLibrary;
