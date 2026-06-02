import Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";

export function calculateVibrantColor(uri) {
  if (!uri || !uri.startsWith("file://")) return null;

  let file = Gio.File.new_for_uri(uri);
  try {
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
      file.get_path(),
      64,
      64,
      true,
    );
    let pixels = pixbuf.get_pixels();
    let rowstride = pixbuf.get_rowstride();
    let channels = pixbuf.get_n_channels();
    let colorMap = new Map();

    for (let y = 0; y < pixbuf.get_height(); y++) {
      for (let x = 0; x < pixbuf.get_width(); x++) {
        let offset = y * rowstride + x * channels;
        let r = pixels[offset],
          g = pixels[offset + 1],
          b = pixels[offset + 2];
        let [h, s, l] = rgbToHsl(r, g, b);

        let step = 24;
        let qr = Math.min(255, Math.floor(r / step) * step + step / 2);
        let qg = Math.min(255, Math.floor(g / step) * step + step / 2);
        let qb = Math.min(255, Math.floor(b / step) * step + step / 2);

        let hex = `#${Math.floor(qr).toString(16).padStart(2, "0")}${Math.floor(qg).toString(16).padStart(2, "0")}${Math.floor(qb).toString(16).padStart(2, "0")}`;

        if (!colorMap.has(hex)) {
          colorMap.set(hex, { count: 0, h: h, s: s, l: l });
        }
        colorMap.get(hex).count += 1;
      }
    }

    let colorsList = [];
    for (let [hex, data] of colorMap.entries()) {
      colorsList.push({
        hex: hex,
        count: data.count,
        h: data.h,
        s: data.s,
        l: data.l,
      });
    }

    let vibrantRanking = [...colorsList].sort((a, b) => {
      let lScoreA = 1 - Math.abs(a.l - 50) / 50;
      let lScoreB = 1 - Math.abs(b.l - 50) / 50;
      let scoreA = a.s * a.s * lScoreA * Math.log(a.count + 1);
      let scoreB = b.s * b.s * lScoreB * Math.log(b.count + 1);
      return scoreB - scoreA;
    });

    let dominantColor = null;

    for (let color of vibrantRanking) {
      if (color.s < 15 || color.l < 15 || color.l > 85) continue;
      dominantColor = color.hex;
      break;
    }

    if (!dominantColor && colorsList.length > 0) {
      let frequencyRanking = [...colorsList].sort((a, b) => b.count - a.count);
      dominantColor = frequencyRanking[0].hex;
    }

    return dominantColor;
  } catch (e) {
    console.error("Error applying color:", e);
    return null;
  }
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
