/**
 * Convert an image file to a WebM video of a given duration (seconds).
 * Uses Canvas + MediaRecorder API (works in Chrome, Edge, Firefox).
 */
export function imageToVideo(imageFile: File, durationSeconds: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      try {
        // Use 1920x1080 max, keeping aspect ratio
        const maxW = 1920;
        const maxH = 1080;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW || h > maxH) {
          const scale = Math.min(maxW / w, maxH / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        // Ensure even dimensions for video encoding
        w = w % 2 === 0 ? w : w + 1;
        h = h % 2 === 0 ? h : h + 1;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        const stream = canvas.captureStream(1); // 1 fps is enough for a still image
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(url);
          const blob = new Blob(chunks, { type: "video/webm" });
          const baseName = imageFile.name.replace(/\.[^.]+$/, "");
          const file = new File([blob], `${baseName}.webm`, { type: "video/webm" });
          resolve(file);
        };

        recorder.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Erro ao converter imagem em vídeo"));
        };

        recorder.start();

        // Keep drawing the frame to ensure the recorder captures it
        const interval = setInterval(() => {
          ctx.drawImage(img, 0, 0, w, h);
        }, 500);

        setTimeout(() => {
          clearInterval(interval);
          recorder.stop();
        }, durationSeconds * 1000);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar imagem"));
    };
    img.src = url;
  });
}
