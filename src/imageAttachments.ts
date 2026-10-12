export const MAX_IMAGE_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function selectImageFiles(
  files: readonly File[],
  currentCount: number,
  replacing: boolean,
): { selected: File[]; notice: string } {
  if (replacing) {
    return {
      selected: files.slice(0, 1),
      notice: files.length > 1 ? "Khi đổi ảnh, em hãy chọn từng ảnh một nhé." : "",
    };
  }
  const available = Math.max(0, MAX_IMAGE_ATTACHMENTS - currentCount);
  const selected = files.slice(0, available);
  return {
    selected,
    notice: selected.length < files.length
      ? "Em có thể gửi tối đa 4 ảnh trong một tin nhắn."
      : "",
  };
}

export function validateImageFile(file: File): string | null {
  if (!supportedImageTypes.has(file.type)) {
    return "Em hãy chọn ảnh JPG, PNG hoặc WEBP nhé.";
  }
  if (file.size === 0) {
    return "Ảnh này đang trống. Em hãy chọn một ảnh khác nhé.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Ảnh vượt quá 10 MiB. Em hãy chọn ảnh nhỏ hơn nhé.";
  }
  return null;
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onabort = () => reject(new Error("Image file reading was cancelled."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        reject(new Error("Image file did not produce a data URL."));
        return;
      }
      const image = new Image();
      image.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Image file did not produce a data URL."));
      };
      image.onerror = () => reject(new Error("Image data could not be decoded."));
      image.src = reader.result;
    };
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Could not read image file."));
    }
  });
}
