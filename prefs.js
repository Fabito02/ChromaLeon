import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class CustomAccentPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window.set_default_size(600, 635);

    this._settings = this.getSettings();
    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    const page = new Adw.PreferencesPage();
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: "Accent Color",
    });
    page.add(group);

    const colorRow = new Adw.ActionRow({
      title: "Main color",
    });

    const colorButton = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      use_alpha: false,
    });

    colorRow.add_suffix(colorButton);
    group.add(colorRow);

    const wallpaperGroup = new Adw.PreferencesGroup({
      title: "Wallpaper Colors",
      description:
        "The system automatically updates the accent color based on your wallpaper.",
    });
    page.add(wallpaperGroup);

    const flatpakGroup = new Adw.PreferencesGroup({
      title: "Flatpak Support",
    });
    page.add(flatpakGroup);

    const flatpakRow = new Adw.ActionRow({
      title: "Apply to Flatpaks",
      subtitle: "Allow Flatpaks to access your custom accent color variables.",
    });

    const flatpakSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
    });

    flatpakRow.add_suffix(flatpakSwitch);
    flatpakGroup.add(flatpakRow);

    this._applyTheme = () => {
      const hex = this._settings.get_string("accent-color");

      const rgba = new Gdk.RGBA();
      rgba.parse(hex);
      colorButton.set_rgba(rgba);

      const cssProvider = new Gtk.CssProvider();
      cssProvider.load_from_data(
        `
          switch:checked {
              background-color: ${hex};
              border-color: ${hex};
          }
        `,
        -1,
      );

      flatpakSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      colorRow.set_subtitle(hex);
    };

    this._applyTheme();

    this._settingsId = this._settings.connect("changed::accent-color", () => {
      this._applyTheme();
    });

    colorButton.connect("color-set", () => {
      const newRgba = colorButton.get_rgba();
      const hex = "#%02x%02x%02x".format(
        Math.round(newRgba.red * 255),
        Math.round(newRgba.green * 255),
        Math.round(newRgba.blue * 255),
      );
      this._settings.set_string("accent-color", hex);
    });

    const checkFlatpakPermissions = () => {
      try {
        const proc = Gio.Subprocess.new(
          ["flatpak", "override", "--user", "--show"],
          Gio.SubprocessFlags.STDOUT_PIPE,
        );
        const [success, stdout] = proc.communicate_utf8(null, null);
        const output = stdout || "";

        const filesystems = output.split("filesystems=")[1]?.split(";");
        return filesystems ? filesystems.includes("xdg-config/gtk-3.0") : false;
      } catch (e) {
        return false;
      }
    };

    flatpakSwitch.set_active(checkFlatpakPermissions());

    flatpakSwitch.connect("notify::active", () => {
      const isActive = flatpakSwitch.get_active();
      
      const commands = isActive
        ? [
            ["flatpak", "override", "--user", "--filesystem=xdg-config/gtk-3.0"],
            ["flatpak", "override", "--user", "--filesystem=xdg-config/gtk-4.0"],
          ]
        : [
            ["flatpak", "override", "--user", "--nofilesystem=xdg-config/gtk-3.0"],
            ["flatpak", "override", "--user", "--nofilesystem=xdg-config/gtk-4.0"],
          ];

      commands.forEach((cmd) => {
        try {
          Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
        } catch (e) {}
      });
    });

    const previewRow = new Adw.PreferencesRow({
      activatable: false,
    });

    this._previewContainer = new Gtk.Box({
      margin_top: 16,
      margin_bottom: 16,
      margin_start: 16,
      margin_end: 16,
      hexpand: true,
      halign: Gtk.Align.FILL,
      valign: Gtk.Align.START,
    });

    previewRow.set_child(this._previewContainer);
    wallpaperGroup.add(previewRow);

    this._colorsRow = new Adw.ActionRow({
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    this._colorBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      margin_top: 10,
      margin_bottom: 10,
    });

    this._colorsRow.add_suffix(this._colorBox);
    wallpaperGroup.add(this._colorsRow);

    this._updateWallpaperUI();

    this._bgChangedId = this._bgSettings.connect(
      "changed::picture-uri-dark",
      () => this._updateWallpaperUI(),
    );

    window.connect("close-request", () => {
      if (this._settingsId) {
        this._settings.disconnect(this._settingsId);
      }
      if (this._bgChangedId) {
        this._bgSettings.disconnect(this._bgChangedId);
      }
      
      this._settings = null;
      this._bgSettings = null;
    });
  }

  _updateWallpaperUI() {
    while (this._previewContainer.get_first_child()) {
      this._previewContainer.remove(this._previewContainer.get_first_child());
    }

    if (this._colorBox) {
      while (this._colorBox.get_first_child()) {
        this._colorBox.remove(this._colorBox.get_first_child());
      }
    }

    let uri = this._bgSettings.get_string("picture-uri-dark");
    if (uri.startsWith("file://")) {
      let file = Gio.File.new_for_uri(uri);

      let preview = new Gtk.Picture();
      preview.set_file(file);
      preview.set_can_shrink(true);
      preview.set_content_fit(Gtk.ContentFit.COVER);
      preview.add_css_class("card");

      let aspectFrame = new Gtk.AspectFrame({
        ratio: 16.0 / 9.0,
        child: preview,
        obey_child: false,
        hexpand: true,
        halign: Gtk.Align.FILL,
        valign: Gtk.Align.START,
        height_request: 240,
      });

      this._previewContainer.append(aspectFrame);
    }

    const colors = this._getWallpaperColors();

    if (colors.length > 0) {
      colors.forEach((hexColor) => {
        let btn = new Gtk.Button({
          valign: Gtk.Align.CENTER,
          halign: Gtk.Align.CENTER,
        });

        let cssProvider = new Gtk.CssProvider();
        let cssString = `
              button {
                  background-color: ${hexColor};
                  min-width: 30px;
                  min-height: 30px;
                  border-radius: 50%;
                  padding: 0;
                  transition: filter 150ms ease-in-out, transform 100ms ease-in-out;
              }
              button:hover {
                  filter: brightness(1.10);
              }
              button:active {
                  filter: brightness(1.20);
              }
            `;

        if (cssProvider.load_from_string) {
          cssProvider.load_from_string(cssString);
        } else {
          cssProvider.load_from_data(cssString, -1);
        }

        btn
          .get_style_context()
          .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        btn.connect("clicked", () => {
          this._settings.set_string("accent-color", hexColor);
        });

        this._colorBox.append(btn);
      });
    } else {
      this._colorsRow.set_subtitle("Unable to load colors.");
    }
  }

  _getWallpaperColors() {
    let uri = this._bgSettings.get_string("picture-uri-dark");

    if (!uri.startsWith("file://")) return [];

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
      let width = pixbuf.get_width();
      let height = pixbuf.get_height();

      let colorMap = new Map();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
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

      let finalColors = [];
      let usedHues = [];

      for (let color of vibrantRanking) {
        if (color.s < 15 || color.l < 15 || color.l > 85) continue;

        let isTooSimilar = false;

        for (let usedHue of usedHues) {
          let hueDiff = Math.abs(color.h - usedHue);
          if (hueDiff > 180) hueDiff = 360 - hueDiff;
          if (hueDiff < 25) {
            isTooSimilar = true;
            break;
          }
        }

        if (!isTooSimilar) {
          finalColors.push(color.hex);
          usedHues.push(color.h);
        }

        if (finalColors.length >= 10) break;
      }

      if (finalColors.length < 10) {
        let frequencyRanking = [...colorsList].sort(
          (a, b) => b.count - a.count,
        );
        for (let color of frequencyRanking) {
          if (finalColors.length >= 10) break;
          if (!finalColors.includes(color.hex)) {
            finalColors.push(color.hex);
          }
        }
      }

      return finalColors;
    } catch (e) {
      return [];
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
}
