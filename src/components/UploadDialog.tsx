import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Film, ImageIcon, Upload, Loader2, Clock, RefreshCw, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { imageToVideo } from "@/lib/imageToVideo";
import { transcodeVideo, needsTranscoding, needsCompression, compressVideo } from "@/lib/transcodeVideo";
import { useToast } from "@/hooks/use-toast";

interface FileEntry {
  file: File;
  name: string;
  thumbnailUrl: string;
  isImage: boolean;
  duration: number;
  convertProgress: number; // 0-100
  uploadProgress: number;  // 0-100
  status: "pending" | "converting" | "compressing" | "uploading" | "done" | "error";
  originalSize?: number;
  compressedSize?: number;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  onComplete: () => void;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      resolve(video.duration || 0);
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
  });
}

function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      resolve(url);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 4);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80;
        canvas.height = Math.round((80 / video.videoWidth) * video.videoHeight) || 45;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          resolve("");
        }
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("");
      };
    } else {
      resolve("");
    }
  });
}

const UploadDialog = ({ open, onOpenChange, files, onComplete }: UploadDialogProps) => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const processedRef = useRef(false);

  // Initialize entries when files change
  useEffect(() => {
    if (!open || files.length === 0) return;
    processedRef.current = false;

    const initEntries = async () => {
      const newEntries: FileEntry[] = [];
      for (const file of files) {
        const isImage = file.type.startsWith("image/");
        const thumb = await generateThumbnail(file);
        const baseName = file.name.replace(/\.[^.]+$/, "");
        newEntries.push({
          file,
          name: baseName,
          thumbnailUrl: thumb,
          isImage,
          duration: 5,
          convertProgress: 0,
          uploadProgress: 0,
          status: "pending",
        });
      }
      setEntries(newEntries);
    };

    initEntries();
  }, [open, files]);

  const updateEntry = (index: number, updates: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)));
  };

  const handleSend = async () => {
    if (processedRef.current) return;
    processedRef.current = true;
    setIsProcessing(true);

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Não autenticado");

      let completed = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        let fileToUpload = entry.file;
        let finalName = entry.name;
        let videoDuration = 0;

        // Convert image to video
        if (entry.isImage) {
          updateEntry(i, { status: "converting", convertProgress: 10 });
          try {
            fileToUpload = await imageToVideo(entry.file, entry.duration);
            finalName = entry.name.replace(/\.[^.]+$/, "") || entry.name;
            videoDuration = entry.duration;
            updateEntry(i, { convertProgress: 100 });
          } catch {
            updateEntry(i, { status: "error" });
            toast({ title: `Erro ao converter "${entry.name}"`, variant: "destructive" });
            continue;
          }
        } else {
          // Get video duration
          videoDuration = await getVideoDuration(entry.file);
        }

        // Transcode video to H.264/MP4 for smart TV compatibility
        if (needsTranscoding(fileToUpload)) {
          updateEntry(i, { status: "converting", convertProgress: 5 });
          try {
            fileToUpload = await transcodeVideo(fileToUpload, (p) => {
              const prog = p.phase === "loading" ? Math.round(p.progress * 0.2) : 20 + Math.round(p.progress * 0.8);
              updateEntry(i, { convertProgress: Math.min(prog, 100) });
            });
            finalName = finalName.replace(/\.[^.]+$/, "") || finalName;
            updateEntry(i, { convertProgress: 100 });
          } catch (err) {
            console.warn("Transcoding failed, uploading original:", err);
          }
        } else if (needsCompression(fileToUpload)) {
          // Compress large MP4 files
          const originalSize = fileToUpload.size;
          updateEntry(i, { status: "compressing", convertProgress: 5, originalSize });
          try {
            fileToUpload = await compressVideo(fileToUpload, (p) => {
              const prog = p.phase === "loading" ? Math.round(p.progress * 0.2) : 20 + Math.round(p.progress * 0.8);
              updateEntry(i, { convertProgress: Math.min(prog, 100) });
            });
            updateEntry(i, { convertProgress: 100, compressedSize: fileToUpload.size });
          } catch (err) {
            console.warn("Compression failed, uploading original:", err);
            updateEntry(i, { compressedSize: originalSize });
          }
        }

        updateEntry(i, { status: "uploading", uploadProgress: 0 });

        const ext = fileToUpload.name.split(".").pop() || "webm";
        const storageName = `${Date.now()}_${finalName}.${ext}`;
        const filePath = `${userId}/${storageName}`;

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(filePath, fileToUpload);

        if (uploadError) {
          updateEntry(i, { status: "error" });
          toast({ title: `Erro ao enviar "${entry.name}"`, description: uploadError.message, variant: "destructive" });
          await supabase.rpc("log_upload_error", {
            p_filename: entry.name,
            p_error_message: uploadError.message,
            p_stage: "upload",
          });
          continue;
        }

        updateEntry(i, { uploadProgress: 80 });

        const displayName = `${finalName}.${ext}`;
        const { data: rpcData, error: dbError } = await supabase.rpc("insert_video", {
          p_filename: displayName,
          p_storage_path: filePath,
          p_file_size: fileToUpload.size,
          p_duration: Math.round(videoDuration),
          p_mime_type: fileToUpload.type || "video/mp4",
        });

        if (dbError || !(rpcData as any)?.ok) {
          updateEntry(i, { status: "error" });
          const errMsg = dbError?.message ?? (rpcData as any)?.error ?? "Erro desconhecido";
          toast({ title: `Erro ao registrar "${entry.name}"`, description: errMsg, variant: "destructive" });
          await supabase.rpc("log_upload_error", {
            p_filename: entry.name,
            p_error_message: errMsg,
            p_stage: "db_insert",
          });
          continue;
        }

        updateEntry(i, { status: "done", uploadProgress: 100 });
        completed++;
      }

      toast({ title: `${completed} arquivo(s) enviado(s) com sucesso!` });
      setTimeout(() => {
        onComplete();
        onOpenChange(false);
      }, 600);
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const hasImages = entries.some((e) => e.isImage);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Renomear Arquivos (opcional)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {entries.map((entry, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {entry.thumbnailUrl ? (
                    <img src={entry.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Name input */}
                <Input
                  value={entry.name}
                  onChange={(e) => updateEntry(i, { name: e.target.value })}
                  disabled={isProcessing}
                  className="bg-background border-border text-sm flex-1"
                />

                {/* Duration for images */}
                {entry.isImage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={entry.duration}
                      onChange={(e) => updateEntry(i, { duration: Math.max(1, Math.min(120, Number(e.target.value))) })}
                      disabled={isProcessing}
                      className="w-16 bg-background border-border text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">s</span>
                  </div>
                )}
              </div>

              {/* Progress bars */}
              {(entry.status === "converting" || entry.status === "compressing" || entry.status === "done" || entry.status === "uploading" || entry.status === "error") && (
                <div className="space-y-1.5">
                  {/* Conversion/Compression progress */}
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-3 h-3 text-muted-foreground flex-shrink-0 ${(entry.status === "converting" || entry.status === "compressing") && entry.convertProgress < 100 ? "animate-spin" : ""}`} />
                    <Progress value={entry.convertProgress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{entry.convertProgress}%</span>
                  </div>

                  {/* Compression savings badge */}
                  {entry.originalSize && entry.compressedSize && entry.compressedSize < entry.originalSize && (
                    <div className="flex items-center gap-1.5 px-1">
                      <ArrowDown className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-500 font-medium">
                        {(entry.originalSize / 1024 / 1024).toFixed(1)}MB → {(entry.compressedSize / 1024 / 1024).toFixed(1)}MB
                        <span className="ml-1 text-green-600">
                          (-{((1 - entry.compressedSize / entry.originalSize) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Upload progress */}
                  <div className="flex items-center gap-2">
                    <Upload className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <Progress value={entry.uploadProgress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {entry.status === "error" ? "Erro" : `${entry.uploadProgress}%`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {hasImages && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Imagens serão convertidas em vídeo com a duração definida
          </p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Vídeos serão convertidos para H.264/MP4 (compatível com Smart TVs)
        </p>

        <DialogFooter>
          <Button onClick={handleSend} disabled={isProcessing || entries.length === 0}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
