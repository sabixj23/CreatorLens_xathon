export type SampledFrame = { id: string; time: number; image: string };

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export async function inspectVideo(file: File): Promise<{ duration: number; width: number; height: number }> {
  if (file.size > 150 * 1024 * 1024) throw new Error("Choose a video smaller than 150 MB.");
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("This video could not be decoded in your browser."));
    });
    if (!Number.isFinite(video.duration) || video.duration < 5 || video.duration > 90) {
      throw new Error("Choose a video between 5 and 90 seconds.");
    }
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function sampleFrames(file: File, duration: number): Promise<SampledFrame[]> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.preload = "auto";
  video.src = url;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Frame extraction is unavailable in this browser.");
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not open the video for frame sampling."));
    });
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const times = [...new Set(Array.from({ length: Math.min(12, Math.ceil(duration / 2)) }, (_, index) =>
      Math.min(duration - 0.1, index * duration / Math.min(12, Math.ceil(duration / 2)))) )];
    const frames: SampledFrame[] = [];
    for (let index = 0; index < times.length; index++) {
      const time = times[index];
      if (Math.abs(video.currentTime - time) > 0.01) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("Could not sample a video frame."));
          video.currentTime = time;
        });
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ id: `f${index + 1}`, time, image: canvas.toDataURL("image/jpeg", 0.72) });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}
