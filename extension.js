/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class CustomAccentExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._generatedCssFile = null;
    this._changedId = null;
    this._bgSettings = null;
    this._bgChangedId = null;
  }

  enable() {
    this._settings = this.getSettings();
    this._updateStyles();
    this._changedId = this._settings.connect(
      "changed::accent-color",
      this._updateStyles.bind(this),
    );
    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });
    this._bgChangedId = this._bgSettings.connect(
      "changed::picture-uri-dark",
      () => {
        this._autoApplyWallpaperColor();
      },
    );
  }

  disable() {
    // Necessary to keep accent colors consistent when unlocking the session
    if (this._changedId) {
      this._settings.disconnect(this._changedId);
      this._changedId = null;
    }
    if (this._bgChangedId) {
      this._bgSettings.disconnect(this._bgChangedId);
      this._bgChangedId = null;
    }

    this._removeShellStylesheet();
    this._removeGtkStylesheet();
    this._settings = null;
    this._bgSettings = null;
  }

  _autoApplyWallpaperColor() {
    let uri = this._bgSettings.get_string("picture-uri-dark");
    if (!uri.startsWith("file://")) return;

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
          let [h, s, l] = this._rgbToHsl(r, g, b);

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
        let frequencyRanking = [...colorsList].sort(
          (a, b) => b.count - a.count,
        );
        dominantColor = frequencyRanking[0].hex;
      }

      if (dominantColor) {
        this._settings.set_string("accent-color", dominantColor);
      }
    } catch (e) {
      console.error("Error applying automatic color:", e);
    }
  }

  _rgbToHsl(r, g, b) {
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

  _removeShellStylesheet() {
    let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
    if (theme && this._generatedCssFile) {
      theme.unload_stylesheet(this._generatedCssFile);
    }
    this._generatedCssFile = null;
  }

  _removeGtkStylesheet() {
    const configDir = GLib.get_user_config_dir();
    const gtkVersions = ["gtk-3.0", "gtk-4.0"];

    gtkVersions.forEach((version) => {
      let dirPath = `${configDir}/${version}`;
      let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
      if (accentFile.query_exists(null)) {
        try {
          accentFile.delete(null);
        } catch (e) {}
      }
      let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
      if (mainFile.query_exists(null)) {
        mainFile.load_contents_async(null, (file, res) => {
          try {
            let [ok, contents] = file.load_contents_finish(res);
            if (ok) {
              let mainContent = new TextDecoder().decode(contents);
              let newContent = mainContent.replace(
                /@import url\("custom-accent\.css"\);\n?/g,
                "",
              );
              file.replace_contents(
                newContent,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
              );
            }
          } catch (e) {}
        });
      }
    });
  }

  _updateStyles() {
    let color = this._settings.get_string("accent-color");
    this._updateShellStylesheet(color);
    this._updateGtkStylesheet(color);
  }

  _updateShellStylesheet(color) {
    let templateFile = Gio.File.new_for_path(
      this.path + "/stylesheet.template.css",
    );
    
    templateFile.load_contents_async(null, (file, res) => {
      try {
        let [ok, contents] = file.load_contents_finish(res);
        if (!ok) return;

        let template = new TextDecoder().decode(contents);
        let css = template.replace(/@@ACCENT@@/g, color);

        let cacheDir = GLib.get_user_cache_dir();
        let outputFile = Gio.File.new_for_path(cacheDir + "/user-accent-colors.css");
        outputFile.replace_contents(
          css,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );

        this._removeShellStylesheet();

        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        if (theme) {
          theme.load_stylesheet(outputFile);
          this._generatedCssFile = outputFile;
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  _updateGtkStylesheet(color) {
    const configDir = GLib.get_user_config_dir();
    const gtkVersions = ["gtk-3.0", "gtk-4.0"];
    const cssVars = `@define-color accent_color ${color};\n@define-color accent_bg_color ${color};\n`;

    gtkVersions.forEach((version) => {
      let dirPath = `${configDir}/${version}`;
      let dir = Gio.File.new_for_path(dirPath);
      if (!dir.query_exists(null)) {
        try {
          dir.make_directory_with_parents(null);
        } catch (e) {
          return;
        }
      }

      let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
      let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);

      try {
        accentFile.replace_contents(
          cssVars,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );
      } catch (e) {}

      let importLine = `@import url("custom-accent.css");\n`;
      
      if (mainFile.query_exists(null)) {
        mainFile.load_contents_async(null, (file, res) => {
          try {
            let [ok, contents] = file.load_contents_finish(res);
            let mainContent = ok ? new TextDecoder().decode(contents) : "";
            
            if (!mainContent.includes("custom-accent.css")) {
              mainContent = importLine + mainContent;
              file.replace_contents(
                mainContent,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
              );
            }
          } catch (e) {}
        });
      } else {
        try {
          mainFile.replace_contents(
            importLine,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
          );
        } catch (e) {}
      }
    });
  }
}