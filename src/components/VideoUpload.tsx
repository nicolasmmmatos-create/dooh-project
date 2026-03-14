import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Video } from "lucide-react";

interface VideoUploadProps {
  playlistId: string;
  onUploadComplete?: () => void;
}

const VideoUpload = ({ playlistId, onUploadComplete }: VideoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.toLowerCase().endsWith(".mov")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo de vídeo.", variant: "destructive" });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 100MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(100);

      const { error: dbError } = await supabase.from("videos").insert({
        playlist_id: playlistId,
        filename: file.name,
        storage_path: filePath,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast({ title: "Vídeo enviado com sucesso!" });
      onUploadComplete?.();
    } catch (error: any) {
      toast({ title: "Erro ao enviar vídeo", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="video/*,video/quicktime,.mov"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full border-dashed border-2 py-8 flex flex-col gap-2"
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <Video className="w-6 h-6 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">
          {uploading ? "Enviando..." : "Clique para adicionar vídeo"}
        </span>
      </Button>
      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
