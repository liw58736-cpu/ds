export function fitImageToResolution(
  width: number,
  height: number,
  resolution = "1K",
) {
  if (!width || !height) throw new Error("无法读取原图尺寸");
  const longest =
    resolution === "4K" ? 4096 : resolution === "2K" ? 2048 : 1024;
  const scale = longest / Math.max(width, height);
  return `${Math.max(16, Math.round((width * scale) / 16) * 16)}x${Math.max(16, Math.round((height * scale) / 16) * 16)}`;
}
export async function imageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error("读取原图尺寸超时，请重新选择图片。")),
      15000,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("无法读取原图，请重新选择图片。"));
    };
    image.src = url;
  });
}
