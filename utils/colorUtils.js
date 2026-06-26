import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";

export function calculateVibrantColor(uri) {
  return new Promise((resolve) => {
    if (!uri || !uri.startsWith("file://")) {
      resolve(null);
      return;
    }

    let file = Gio.File.new_for_uri(uri);

    file.read_async(GLib.PRIORITY_DEFAULT, null, (source_object, res) => {
      try {
        let stream = source_object.read_finish(res);

        GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
          stream,
          64,
          64,
          true,
          null,
          (obj, asyncRes) => {
            try {
              let pixbuf = GdkPixbuf.Pixbuf.new_from_stream_finish(asyncRes);

              stream.close_async(GLib.PRIORITY_DEFAULT, null, () => {});

              let color = _processPixbuf(pixbuf);
              resolve(color);
            } catch (e) {
              console.error("Error creating pixbuf:", e);
              resolve(null);
            }
          },
        );
      } catch (e) {
        console.error("Error reading file:", e);
        resolve(null);
      }
    });
  });
}

export function _getRelativeLuminance(r, g, b) {
  const adjustChannel = (color) => {
    return color <= 0.04045
      ? color / 12.92
      : Math.pow((color + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * adjustChannel(r) +
    0.7152 * adjustChannel(g) +
    0.0722 * adjustChannel(b)
  );
}

export function _getContrastRatio(lum1, lum2) {
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = (brightest + 0.05) / (darkest + 0.05);

  return Math.round(ratio * 100) / 100;
}

function _processPixbuf(pixbuf) {
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
    const { r, g, b } = hslToRgb(color.h, color.s, color.l);
    const luminance = _getRelativeLuminance(r, g, b);

    if (_getContrastRatio(luminance, 0.91) >= 4.5) {
      dominantColor = color.hex;
      break;
    }
  }

  if (!dominantColor && colorsList.length > 0) {
    let frequencyRanking = [...colorsList].sort((a, b) => b.count - a.count);
    dominantColor = frequencyRanking[0].hex;
  }

  return dominantColor;
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, Math.round(l * 100)];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  return [Math.round((h / 6) * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) return { r: l, g: l, b: l };

  const hueToRgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3),
  };
}
