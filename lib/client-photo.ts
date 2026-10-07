const TARGET_UPLOAD_BYTES = 700 * 1024;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1600;

function loadImage(file: File) {
  return new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not prepare ${file.name}. Choose a smaller photo or a screenshot.`));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Photo optimization failed.")),
      "image/jpeg",
      quality,
    );
  });
}

function optimizedFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}-optimized.jpg`;
}

export function validatePhotoSelection(files: File[]) {
  if (files.length > 5) return "Choose up to 5 photos at a time.";
  if (files.some((file) => file.size > MAX_SOURCE_BYTES)) {
    return "Each original photo must be 10 MB or smaller.";
  }
  return "";
}

export async function optimizePhoto(file: File) {
  if (file.size <= TARGET_UPLOAD_BYTES) return file;

  const { image, url } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error(`Could not read ${file.name}.`);

    let scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    let smallest: Blob | null = null;

    for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo optimization is unavailable in this browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await canvasBlob(canvas, quality);
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= TARGET_UPLOAD_BYTES) {
          return new File([blob], optimizedFilename(file.name), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
      }
      scale *= 0.78;
    }

    if (smallest && smallest.size <= TARGET_UPLOAD_BYTES) {
      return new File([smallest], optimizedFilename(file.name), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    }
    throw new Error(`Could not reduce ${file.name} enough for a reliable upload.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
