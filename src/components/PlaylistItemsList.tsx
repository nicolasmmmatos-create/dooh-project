import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, GripVertical, Film, Clock, Plus, Eye, EyeOff } from "lucide-react";

interface PlaylistVideo {
  id: string;
  filename: string;
  storage_path: string;
  order_index: number | null;
  duration: number | null;
  page_number: number;
  is_active: boolean;
  thumbnailUrl?: string;
}

interface PlaylistItemsListProps {
  playlistId: string;
  onChanged?: () => void;
  onPageChange?: (page: number) => void;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

const MAX_PAGES = 5;

const PlaylistItemsList = ({ playlistId, onChanged, onPageChange }: PlaylistItemsListProps) => {
  const [allItems, setAllItems] = useState<PlaylistVideo[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [pages, setPages] = useState<number[]>([1]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("videos")
      .select("id, filename, storage_path, order_index, duration, page_number, is_active")
      .eq("playlist_id", playlistId)
      .order("page_number", { ascending: true })
      .order("order_index", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const withThumbs: PlaylistVideo[] = (data || []).map((v) => ({
      ...v,
      page_number: v.page_number || 1,
      is_active: v.is_active !== false,
      thumbnailUrl: `https://qbslxssxkxgugwkjnlqu.supabase.co/storage/v1/object/public/videos/${v.storage_path}`,
    }));

    setAllItems(withThumbs);

    // Determine existing pages
    const existingPages = [...new Set(withThumbs.map((v) => v.page_number))].sort();
    if (existingPages.length === 0) existingPages.push(1);
    setPages(existingPages);
    if (!existingPages.includes(activePage)) setActivePage(existingPages[0]);

    setLoading(false);

    // Generate thumbnails + detect duration
    withThumbs.forEach((item, i) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.crossOrigin = "anonymous";
      video.src = item.thumbnailUrl || "";
      video.onloadedmetadata = () => {
        const detectedDuration = Math.round(video.duration || 0);
        if ((!item.duration || item.duration === 0) && detectedDuration > 0) {
          setAllItems((prev) => prev.map((it, idx) => idx === i ? { ...it, duration: detectedDuration } : it));
          supabase.from("videos").update({ duration: detectedDuration }).eq("id", item.id).then(() => {});
        }
        video.currentTime = Math.min(1, video.duration / 4);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = Math.round((64 / video.videoWidth) * video.videoHeight) || 36;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setAllItems((prev) => prev.map((it, idx) => idx === i ? { ...it, thumbnailUrl: dataUrl } : it));
      };
    });
  };

  useEffect(() => {
    fetchItems();
  }, [playlistId]);

  useEffect(() => {
    onPageChange?.(activePage);
  }, [activePage]);

  const pageItems = allItems.filter((v) => v.page_number === activePage);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
  };

  const handleDragEnter = (index: number) => {
    const from = dragItemRef.current;
    if (from === null || from === index) return;
    dragOverRef.current = index;

    // Preview em tempo real: reordena visualmente durante o arraste
    const newItems = [...pageItems];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(index, 0, moved);
    const updated = newItems.map((item, i) => ({ ...item, order_index: i }));

    dragItemRef.current = index;
    setDragIndex(index);

    setAllItems((prev) => {
      const others = prev.filter((v) => v.page_number !== activePage);
      return [...others, ...updated].sort(
        (a, b) => (a.page_number - b.page_number) || ((a.order_index || 0) - (b.order_index || 0))
      );
    });
  };

  const handleDragEnd = async () => {
    const finalItems = allItems
      .filter((v) => v.page_number === activePage)
      .map((item, i) => ({ ...item, order_index: i }));

    setDragIndex(null);
    dragItemRef.current = null;
    dragOverRef.current = null;

    setSaving(true);
    await Promise.all(
      finalItems.map((item) =>
        supabase.from("videos").update({ order_index: item.order_index }).eq("id", item.id)
      )
    );
    setSaving(false);
    onChanged?.();
  };

  const toggleActive = async (id: string, current: boolean) => {
    setAllItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, is_active: !current } : it))
    );
    const { error } = await supabase
      .from("videos")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) {
      setAllItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, is_active: current } : it))
      );
      toast({ title: "Erro ao atualizar mídia", description: error.message, variant: "destructive" });
    } else {
      onChanged?.();
    }
  };

  const removeItem = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from("videos").update({ playlist_id: null }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mídia removida da playlist" });
      fetchItems();
      onChanged?.();
    }
    setSaving(false);
  };

  const addPage = () => {
    const nextPage = pages.length > 0 ? Math.max(...pages) + 1 : 1;
    if (nextPage > MAX_PAGES) {
      toast({ title: "Limite atingido", description: "Máximo de 5 páginas por playlist.", variant: "destructive" });
      return;
    }
    setPages((prev) => [...prev, nextPage].sort());
    setActivePage(nextPage);
  };

  const removePage = async (page: number) => {
    if (pages.length <= 1) {
      toast({ title: "Mínimo 1 página", variant: "destructive" });
      return;
    }
    const pageVideos = allItems.filter((v) => v.page_number === page);
    if (pageVideos.length > 0) {
      setSaving(true);
      await Promise.all(
        pageVideos.map((v) =>
          supabase.from("videos").update({ playlist_id: null }).eq("id", v.id)
        )
      );
      setSaving(false);
    }
    const newPages = pages.filter((p) => p !== page);
    setPages(newPages);
    setActivePage(newPages[0]);
    fetchItems();
    onChanged?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Page tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePage === page
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Pág. {page}
            <span className="ml-1 opacity-60">
              ({allItems.filter((v) => v.page_number === page).length})
            </span>
          </button>
        ))}
        {pages.length < MAX_PAGES && (
          <button
            onClick={addPage}
            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
        {pages.length > 1 && (
          <button
            onClick={() => removePage(activePage)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-all ml-auto"
          >
            Remover pág. {activePage}
          </button>
        )}
      </div>

      {/* Items for active page */}
      {pageItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma mídia na página {activePage}.
        </p>
      ) : (
        <div className="space-y-1 max-h-[250px] overflow-y-auto">
          {pageItems.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-2 p-2 rounded-lg border bg-muted/30 group transition-all ${
                dragIndex === index ? "border-primary opacity-50" : "border-border"
              } ${!item.is_active ? "opacity-50" : ""}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
              <div className="w-10 h-7 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {item.thumbnailUrl?.startsWith("data:") ? (
                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground w-5 text-center shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{item.filename}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                {formatDuration(item.duration || 0)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title={item.is_active ? "Desativar mídia" : "Ativar mídia"}
                onClick={() => toggleActive(item.id, item.is_active)}
              >
                {item.is_active
                  ? <Eye className="w-3.5 h-3.5 text-primary" />
                  : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={saving}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistItemsList;
