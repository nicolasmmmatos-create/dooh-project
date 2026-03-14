/**
 * Compress video using native MediaRecorder API (no FFmpeg dependency).
 * Downscales to 720p and re-encodes at 1.5 Mbps for Smart TV compatibility.
 */

/** Check if a file needs transcoding (not already H.264 mp4) */
export function needsTranscoding(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".mov") || type === "video/quicktime") return true;
  const videoExtensions = [".webm", ".avi", ".mkv", ".flv", ".wmv", ".3gp", ".ts", ".m4v"];
  if (videoExtensions.some((ext) => name.endsWith(ext))) return true;
  if (name.endsWith(".mp4") || type === "video/mp4") return false;
  return true;
}

/** Check if an MP4 file is large enough to benefit from compression */
export function needsCompression(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isMp4 = name.endsWith(".mp4") || type === "video/mp4";
  return isMp4 && file.size > 5 * 1024 * 1024;
}

export interface TranscodeProgress {
  phase: "loading" | "transcoding";
  progress: number; // 0-100
}

export async function compressVideo(
  file: File,
  onProgress?: (p: TranscodeProgress) => void
): Promise<File> {
  if (file.size < 5 * 1024 * 1024) {
    onProgress?.({ phase: "transcoding", progress: 100 });
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const url = URL.createObjectURL(file);

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      onProgress?.({ phase: "loading", progress: 100 });

      const MAX_W = 1280;
      const MAX_H = 720;
      const isPortrait = video.videoHeight > video.videoWidth;

      if (isPortrait) {
        const ratio = Math.min(MAX_W / video.videoHeight, MAX_H / video.videoWidth, 1);
        canvas.width = Math.floor(video.videoHeight * ratio);
        canvas.height = Math.floor(video.videoWidth * ratio);
      } else {
        const ratio = Math.min(MAX_W / video.videoWidth, MAX_H / video.videoHeight, 1);
        canvas.width = Math.floor(video.videoWidth * ratio);
        canvas.height = Math.floor(video.videoHeight * ratio);
      }

      const ctx = canvas.getContext("2d")!;

      // For portrait videos, apply rotation transform so output is always landscape
      if (isPortrait) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.translate(-canvas.height / 2, -canvas.width / 2);
      }

      const stream = canvas.captureStream(30);

      const mimeType =
        [
          "video/mp4;codecs=avc1",
          "video/webm;codecs=h264",
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
        ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: mimeType });
        const result = blob.size < file.size ? blob : file;
        // Always output as .mp4 for Smart TV compatibility
        const compressed = new File(
          [result],
          file.name.replace(/\.[^.]+$/, ".mp4"),
          { type: "video/mp4" }
        );
        onProgress?.({ phase: "transcoding", progress: 100 });
        resolve(compressed);
      };

      recorder.start(100);
      await video.play();

      const duration = video.duration * 1000;

      const tick = () => {
        if (video.ended || video.currentTime >= video.duration) {
          recorder.stop();
          return;
        }
        if (isPortrait) {
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const elapsed = video.currentTime * 1000;
        onProgress?.({
          phase: "transcoding",
          progress: Math.min(99, Math.round((elapsed / duration) * 100)),
        });
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      video.onended = () => recorder.stop();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      onProgress?.({ phase: "transcoding", progress: 100 });
      resolve(file);
    };
  });
}

/**
 * Transcode a video file using MediaRecorder (same as compress but for non-mp4 files).
 */
export async function transcodeVideo(
  file: File,
  onProgress?: (p: TranscodeProgress) => void
): Promise<File> {
  return compressVideo(file, onProgress);
}
