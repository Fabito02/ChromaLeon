import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import * as Gettext from "gettext";
import GdkPixbuf from "gi://GdkPixbuf";
import { rgbToHsl } from "./utils/colorUtils.js";

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  const localeDir = GLib.get_current_dir() + "/locale";
  Gettext.bindtextdomain("chromaleon", localeDir);
}

const _ = (str) => {
  try {
    return Gettext.dgettext("chromaleon", str);
  } catch (e) {
    return str;
  }
};

class ChromaLeonUI {
  constructor(window, page, settings) {
    this._settings = settings;
    this._page = page;
    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._settingsId = null;
    this._bgChangedId1 = null;
    this._bgChangedId2 = null;
    this._colorSchemeId = null;

    const group = new Adw.PreferencesGroup({
      title: _("Accent Color"),
      description: _("New colors only apply when apps are reopened."),
    });
    this._page.add(group);

    const colorRow = new Adw.ActionRow({ title: _("Main color") });
    const colorButton = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      use_alpha: false,
    });
    colorRow.add_suffix(colorButton);
    group.add(colorRow);

    colorButton.connect("color-set", () => {
      const { red, green, blue } = colorButton.get_rgba();

      const toHex = (val) =>
        Math.round(val * 255)
          .toString(16)
          .padStart(2, "0");
      const hex = `#${toHex(red)}${toHex(green)}${toHex(blue)}`;

      this._settings.set_string("accent-color", hex);
      this._settings.set_boolean("custom-color", true);
    });

    const wallpaperGroup = new Adw.PreferencesGroup({
      title: _("Wallpaper Colors"),
      description: _(
        "The system automatically updates the accent color based on your wallpaper.",
      ),
    });
    this._page.add(wallpaperGroup);

    const previewRow = new Adw.PreferencesRow({ activatable: false });
    this._previewContainer = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      hexpand: true,
      halign: Gtk.Align.FILL,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 12,
      margin_end: 12,
    });
    previewRow.set_child(this._previewContainer);
    wallpaperGroup.add(previewRow);

    this._colorsRow = new Adw.ActionRow();

    this._mainColorBox = new Adw.WrapBox({
      child_spacing: 12,
      line_spacing: 12,
      align: 0.5,
      margin_top: 12,
      margin_bottom: 12,
      line_homogeneous: true,
      margin_start: 12,
      margin_end: 12,
    });

    this._moreColors = new Adw.ExpanderRow({
      title: _("Additional colors"),
    });

    this._moreColorBox = new Adw.WrapBox({
      child_spacing: 12,
      line_spacing: 12,
      align: 0.5,
      margin_top: 12,
      margin_bottom: 12,
      line_homogeneous: true,
      margin_start: 12,
      margin_end: 12,
    });

    const colorRowWrapper = new Gtk.ListBoxRow({
      activatable: false,
      selectable: false,
      child: this._moreColorBox,
    });

    this._moreColors.add_row(colorRowWrapper);
    this._colorsRow.set_child(this._mainColorBox);

    wallpaperGroup.add(this._colorsRow);
    wallpaperGroup.add(this._moreColors);

    const tintGnomeGroup = new Adw.PreferencesGroup({
      title: _("Tint Gnome"),
      description: _("Based on Tint my Gnome"),
    });
    this._page.add(tintGnomeGroup);

    const TintShellRow = new Adw.ActionRow({
      title: _("Tint shell"),
      subtitle: _("Tints the Gnome Shell with the color of your choice."),
    });

    const TintShellSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    TintShellRow.add_suffix(TintShellSwitch);
    tintGnomeGroup.add(TintShellRow);

    const TintAppsRow = new Adw.ActionRow({
      title: _("Tint apps"),
      subtitle: _(
        "Tints the LibAdwaita applications with the color of your choice.",
      ),
    });

    const TintAppsSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    TintAppsRow.add_suffix(TintAppsSwitch);
    tintGnomeGroup.add(TintAppsRow);

    this._settings.bind(
      "tint-shell",
      TintShellSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "tint-apps",
      TintAppsSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const iconThemeGroup = new Adw.PreferencesGroup({
      title: _("Icon Theme"),
    });
    this._page.add(iconThemeGroup);

    const iconThemeFolderRow = new Adw.ActionRow({
      title: _("Folder icon theme"),
      subtitle: _("Applies the accent color to folder icons."),
    });

    const iconThemeFolderSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    iconThemeFolderRow.add_suffix(iconThemeFolderSwitch);
    iconThemeGroup.add(iconThemeFolderRow);

    const iconThemeAppRow = new Adw.ActionRow({
      title: _("Application icon theme"),
      subtitle: _("Applies the accent color to some app icons."),
    });

    const iconThemeAppSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    iconThemeAppRow.add_suffix(iconThemeAppSwitch);
    iconThemeGroup.add(iconThemeAppRow);

    const morewaitaRow = new Adw.ActionRow({
      title: _("MoreWaita"),
      subtitle: _("Applies integration with the MoreWaita icon pack."),
    });
    iconThemeGroup.add(morewaitaRow);

    const morewaitaSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    morewaitaRow.add_suffix(morewaitaSwitch);
    iconThemeGroup.add(morewaitaRow);

    this._settings.bind(
      "recolor-folders",
      iconThemeFolderSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "recolor-apps",
      iconThemeAppSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "morewaita",
      morewaitaSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    iconThemeFolderSwitch.bind_property(
      "active",
      iconThemeAppRow,
      "sensitive",
      GObject.BindingFlags.SYNC_CREATE,
    );

    iconThemeFolderSwitch.bind_property(
      "active",
      morewaitaRow,
      "sensitive",
      GObject.BindingFlags.SYNC_CREATE,
    );

    const miscellaneousGroup = new Adw.PreferencesGroup({
      title: _("Miscellaneous"),
    });
    this._page.add(miscellaneousGroup);

    const flatpakRow = new Adw.ActionRow({
      title: _("Apply to Flatpaks"),
      subtitle: _(
        "Allow Flatpaks to access your custom accent color variables.",
      ),
    });
    const flatpakSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    flatpakRow.add_suffix(flatpakSwitch);
    miscellaneousGroup.add(flatpakRow);

    const shortcutRow = new Adw.ActionRow({
      title: _("Enable shortcut"),
      subtitle: _(
        "Create a shortcut in the app grid by adding a .desktop file.",
      ),
    });
    const shortcutSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    shortcutRow.add_suffix(shortcutSwitch);
    miscellaneousGroup.add(shortcutRow);

    this._settings.bind(
      "create-shortcut",
      shortcutSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const checkFlatpakPermissions = () => {
      try {
        const proc = Gio.Subprocess.new(
          ["flatpak", "override", "--user", "--show"],
          Gio.SubprocessFlags.STDOUT_PIPE,
        );

        let stdoutData = proc.communicate_utf8(null, null)[1];
        return (
          (stdoutData || "")
            .split("filesystems=")[1]
            .split(";")
            .includes("xdg-config/gtk-3.0") || false
        );
      } catch (e) {
        return false;
      }
    };

    flatpakSwitch.set_active(checkFlatpakPermissions());
    flatpakSwitch.connect("notify::active", () => {
      const isActive = flatpakSwitch.get_active();
      const commands = isActive
        ? [
            [
              "flatpak",
              "override",
              "--user",
              "--filesystem=xdg-config/gtk-3.0",
            ],
            [
              "flatpak",
              "override",
              "--user",
              "--filesystem=xdg-config/gtk-4.0",
            ],
          ]
        : [
            [
              "flatpak",
              "override",
              "--user",
              "--nofilesystem=xdg-config/gtk-3.0",
            ],
            [
              "flatpak",
              "override",
              "--user",
              "--nofilesystem=xdg-config/gtk-4.0",
            ],
          ];
      commands.forEach((cmd) => {
        try {
          Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
        } catch (e) {}
      });
    });

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

      TintAppsSwitch.get_style_context().add_provider(
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );
      TintShellSwitch.get_style_context().add_provider(
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );
      flatpakSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      shortcutSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      iconThemeFolderSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      iconThemeAppSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      morewaitaSwitch
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      colorRow.set_subtitle(hex);

      if (this._wallpaperButtons) {
        this._wallpaperButtons.forEach((item) => item.updateStyle(hex));
      }
    };

    this._applyTheme();

    this._settingsId = this._settings.connect("changed::accent-color", () =>
      this._applyTheme(),
    );

    this._updateWallpaperUI();

    this._colorSchemeId = this._interfaceSettings.connect(
      "changed::color-scheme",
      () => this._updateWallpaperUI(),
    );

    this._bgChangedId1 = this._bgSettings.connect(
      "changed::picture-uri-dark",
      () => this._updateWallpaperUI(),
    );

    this._bgChangedId2 = this._bgSettings.connect("changed::picture-uri", () =>
      this._updateWallpaperUI(),
    );

    window.connect("close-request", () => {
      if (this._settingsId) this._settings.disconnect(this._settingsId);
      if (this._bgChangedId1) this._bgSettings.disconnect(this._bgChangedId1);
      if (this._bgChangedId2) this._bgSettings.disconnect(this._bgChangedId2);
      if (this._colorSchemeId)
        this._interfaceSettings.disconnect(this._colorSchemeId);
      this._settings = null;
      this._bgSettings = null;
    });
  }

  async _updateWallpaperUI() {
    while (this._previewContainer.get_first_child())
      this._previewContainer.remove(this._previewContainer.get_first_child());

    if (this._mainColorBox) {
      while (this._mainColorBox.get_first_child())
        this._mainColorBox.remove(this._mainColorBox.get_first_child());
    }
    if (this._moreColorBox) {
      while (this._moreColorBox.get_first_child())
        this._moreColorBox.remove(this._moreColorBox.get_first_child());
    }

    let colorScheme = this._interfaceSettings.get_string("color-scheme");
    let uri =
      colorScheme === "prefer-dark"
        ? this._bgSettings.get_string("picture-uri-dark")
        : this._bgSettings.get_string("picture-uri");

    if (uri.startsWith("file://")) {
      let file = Gio.File.new_for_uri(uri);

      let preview = new Gtk.Picture({
        file: file,
        can_shrink: true,
        content_fit: Gtk.ContentFit.COVER,
        hexpand: true,
        halign: Gtk.Align.FILL,
        height_request: 200,
      });
      preview.add_css_class("card");

      this._previewContainer.append(preview);
    }

    const colors = await this._getWallpaperColorsAsync(uri);

    if (colors && colors.length > 0) {
      this._colorsRow.set_subtitle("");
      this._wallpaperButtons = [];

      this._moreColors.set_visible(colors.length > 10);

      while (this._mainColorBox.get_first_child()) {
        this._mainColorBox.remove(this._mainColorBox.get_first_child());
      }

      while (this._moreColorBox.get_first_child()) {
        this._moreColorBox.remove(this._moreColorBox.get_first_child());
      }

      colors.forEach((hexColor, index) => {
        let btn = new Gtk.Button({
          valign: Gtk.Align.CENTER,
          halign: Gtk.Align.CENTER,
        });

        let cssProvider = new Gtk.CssProvider();

        const updateButtonStyle = (currentAccentColor) => {
          let cssString =
            currentAccentColor === hexColor
              ? `button {
                  background-color: ${hexColor};
                  min-width: 20px;
                  min-height: 20px;
                  border-radius: 50%;
                  padding: 0;
                  margin: 5px;
                  outline: 3px solid ${hexColor};
                  outline-offset: 3px;
                }
                button:focus {
                  outline: 3px solid ${hexColor}70;
                }`
              : `button {
                  background-color: ${hexColor};
                  min-width: 30px;
                  min-height: 30px;
                  border-radius: 50%;
                  padding: 0;
                  margin: 0px;
                  outline: none;
                }
                button:focus {
                  min-width: 20px;
                  min-height: 20px;
                  margin: 5px;
                  outline: 3px solid ${hexColor}60;
                  outline-offset: 3px;
                }`;

          if (cssProvider.load_from_string)
            cssProvider.load_from_string(cssString);
          else cssProvider.load_from_data(cssString, -1);
        };

        let currentColor = this._settings.get_string("accent-color");
        updateButtonStyle(currentColor);

        this._wallpaperButtons.push({ updateStyle: updateButtonStyle });

        btn
          .get_style_context()
          .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        btn.connect("clicked", () => {
          this._settings.set_string("accent-color", hexColor);
          this._settings.set_boolean("custom-color", true);
        });

        if (index < 10) {
          this._mainColorBox.append(btn);
        } else {
          this._moreColorBox.append(btn);
        }
      });
    } else {
      this._colorsRow.set_subtitle(_("Unable to load colors."));
      this._moreColors.set_visible(false);
    }
  }

  _getWallpaperColorsAsync(uri) {
    return new Promise((resolve) => {
      if (!uri || !uri.startsWith("file://")) {
        resolve([]);
        return;
      }

      let file = Gio.File.new_for_uri(uri);

      file.read_async(GLib.PRIORITY_DEFAULT, null, (source, res) => {
        try {
          let stream = source.read_finish(res);

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

                let finalColors = this._extractColorsFromPixbuf(pixbuf);
                resolve(finalColors);
              } catch (e) {
                resolve([]);
              }
            },
          );
        } catch (e) {
          resolve([]);
        }
      });
    });
  }

  _extractColorsFromPixbuf(pixbuf) {
    let pixels = pixbuf.get_pixels(),
      rowstride = pixbuf.get_rowstride(),
      channels = pixbuf.get_n_channels();
    let width = pixbuf.get_width(),
      height = pixbuf.get_height();
    let colorMap = new Map();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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

        if (!colorMap.has(hex))
          colorMap.set(hex, { count: 0, h: h, s: s, l: l });
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
      let scoreA =
        a.s * a.s * (1 - Math.abs(a.l - 50) / 50) * Math.log(a.count + 1);
      let scoreB =
        b.s * b.s * (1 - Math.abs(b.l - 50) / 50) * Math.log(b.count + 1);
      return scoreB - scoreA;
    });

    let finalColors = [];
    let usedColorsData = [];

    const isTooSimilarToExisting = (color) => {
      for (let used of usedColorsData) {
        let hueDiff = Math.abs(color.h - used.h);
        if (hueDiff > 180) hueDiff = 360 - hueDiff;

        let satDiff = Math.abs(color.s - used.s);
        let lightDiff = Math.abs(color.l - used.l);

        if (hueDiff < 25 && satDiff < 20 && lightDiff < 20) {
          return true;
        }
      }
      return false;
    };

    for (let color of vibrantRanking) {
      if (color.s < 15 || color.l < 15 || color.l > 85) continue;

      if (!isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    let frequencyRanking = [...colorsList].sort((a, b) => b.count - a.count);
    for (let color of frequencyRanking) {
      if (color.l < 10 || color.l > 90) continue;

      if (!finalColors.includes(color.hex) && !isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    return finalColors.slice(0, 60);
  }
}

function setupCustomHeader(window, extensionPath) {
  window.search_enabled = true;

  const iconPath = extensionPath
    ? `${extensionPath}/assets/heart-filled-symbolic.svg`
    : "./assets/heart-filled-symbolic.svg";
  const donateIcon = Gtk.Image.new_from_file(iconPath);

  const donateButton = new Gtk.Button({ valign: Gtk.Align.CENTER });
  donateButton.set_child(donateIcon);
  donateButton.add_css_class("flat");
  donateButton.set_tooltip_text(_("Support the project"));
  donateButton.add_css_class("heart-button");

  const cssProvider = new Gtk.CssProvider();
  cssProvider.load_from_data(`.heart-button:hover { color: #FF5C5C; }`, -1);
  donateButton
    .get_style_context()
    .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

  donateButton.connect("clicked", () => {
    const dialog = new Adw.MessageDialog({
      transient_for: window,
      heading: _("Why support ChromaLeon?"),
      body: _(
        "Developing free software requires time, energy, and dedication. Your donation directly supports the project and helps keep it alive!",
      ),
      close_response: "cancel",
    });
    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("donate", _("Support"));
    dialog.set_response_appearance("donate", Adw.ResponseAppearance.SUGGESTED);
    dialog.connect("response", (d, response) => {
      if (response === "donate") {
        Gio.AppInfo.launch_default_for_uri(
          "https://buymeacoffee.com/fabito02",
          null,
        );
      }
      d.destroy();
    });
    dialog.present();
  });

  GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    const inject = (parent) => {
      for (
        let child = parent.get_first_child();
        child !== null;
        child = child.get_next_sibling()
      ) {
        if (child instanceof Adw.HeaderBar || child instanceof Gtk.HeaderBar) {
          child.pack_end(donateButton);
          return true;
        }
        if (inject(child)) return true;
      }
      return false;
    };
    inject(window);
    return GLib.SOURCE_REMOVE;
  });
}

export function buildUI(window, page, settings, extensionPath) {
  setupCustomHeader(window, extensionPath);
  new ChromaLeonUI(window, page, settings);
}

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  GLib.set_application_name("ChromaLeon");

  const app = new Adw.Application({
    application_id: "com.github.fabito02.chromaleon",
  });

  app.connect("activate", (app) => {
    const window = new Adw.PreferencesWindow({ application: app });
    window.set_default_size(600, 635);
    window.set_title("ChromaLeon");

    const page = new Adw.PreferencesPage();
    window.add(page);

    const settings = new Gio.Settings({
      schema_id: "org.gnome.shell.extensions.chromaleon",
      path: "/org/gnome/shell/extensions/chromaleon/",
    });

    buildUI(window, page, settings, GLib.get_current_dir());

    window.present();
  });

  app.run(ARGV);
}
