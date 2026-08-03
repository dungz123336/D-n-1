/** Nén ảnh trước khi lưu localStorage (tránh vượt quota → mất dữ liệu). */
export function compressImageFile(
  file: File,
  maxSide = 720,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ảnh không hợp lệ"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG nhỏ hơn PNG cho ảnh bìa
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
