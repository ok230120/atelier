// FILE: src/services/thumbnail.ts

/**
 * Service for handling thumbnail generation and manipulation.
 */

// Capture current frame from a video element
export async function captureCurrentFrame(
  video: HTMLVideoElement,
  width = 320,
  height = 180
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Export as WebP
    return canvas.toDataURL('image/webp', 0.8);
  } catch (err) {
    console.error('Failed to capture video frame:', err);
    return null;
  }
}

// Convert File object to data URL
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Read image from clipboard as data URL
export async function readClipboardImageAsDataUrl(): Promise<string | null> {
  try {
    // Clipboard API が使えない環境では null を返す
    if (!('clipboard' in navigator) || !('read' in navigator.clipboard)) {
      return null;
    }

    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], 'clipboard-image', { type: imageType });
        return await fileToDataUrl(file);
      }
    }

    // 画像が見つからなかった
    return null;
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
    // Clipboard API は https / localhost / フォーカスなど条件がある
    return null;
  }
}

// TODO: thumbStore === "folder" のときに外部フォルダへ保存する処理を追加する
