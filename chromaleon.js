#!@GJS@ -m

/*
 * chromaleon.js
 *
 * This file is part of ChromaLeon GNOME Shell Extension.
 * https://github.com/Fabito02/ChromaLeon
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import * as Gettext from "gettext";
import GdkPixbuf from "gi://GdkPixbuf";
import {
  rgbToHsl,
  hslToRgb,
  _getRelativeLuminance,
  _getContrastRatio,
} from "./utils/colorUtils.js";
import GnomeDesktop from "gi://GnomeDesktop?version=4.0";

Gio._promisify(
  Gio.File.prototype,
  "enumerate_children_async",
  "enumerate_children_finish",
);
Gio._promisify(
  Gio.FileEnumerator.prototype,
  "next_files_async",
  "next_files_finish",
);

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);
Gio._promisify(Gio.File.prototype, "query_info_async", "query_info_finish");

Gio._promisify(
  GnomeDesktop.DesktopThumbnailFactory.prototype,
  "generate_thumbnail_async",
  "generate_thumbnail_finish",
);

Gio._promisify(
  GnomeDesktop.DesktopThumbnailFactory.prototype,
  "save_thumbnail_async",
  "save_thumbnail_finish",
);

Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");

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

const currentModulePath = import.meta.url;
const extensionDirPath = currentModulePath.startsWith("file://")
  ? Gio.File.new_for_uri(currentModulePath).get_parent().get_path()
  : GLib.get_current_dir();

const thumbnailFactory = GnomeDesktop.DesktopThumbnailFactory.new(
  GnomeDesktop.DesktopThumbnailSize.LARGE,
);

async function getThumbnail(path) {
  try {
    const file = Gio.File.new_for_path(path);
    const uri = file.get_uri();

    const info = await file.query_info_async(
      "standard::content-type,time::modified",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
    );

    const mimeType = info.get_content_type();
    const mtime = info.get_attribute_uint64("time::modified");

    let thumb = thumbnailFactory.lookup(uri, mtime);

    if (thumb) return thumb;

    if (!thumbnailFactory.can_thumbnail(uri, mimeType, mtime)) return path;

    const pixbuf = await thumbnailFactory.generate_thumbnail_async(
      uri,
      mimeType,
      null,
    );

    if (!pixbuf) return path;

    await thumbnailFactory.save_thumbnail_async(pixbuf, uri, mtime, null);

    thumb = thumbnailFactory.lookup(uri, mtime);

    return thumb ?? path;
  } catch (e) {
    throw new Error(_("Error getting thumbnail: " + e.message));
  }
}

class ChromaLeonUI {
  constructor(window, page, settings) {
    this._settings = settings;

    this._page = page;
    this._page.set_title(_("Wallpaper"));
    this._page.set_icon_name("image-round-symbolic");
    this._page.add_css_class("symbolic");

    this._optionsPage = new Adw.PreferencesPage({
      title: _("Preferences"),
      icon_name: "settings-symbolic",
    });
    this._optionsPage.add_css_class("symbolic");

    window.add(this._optionsPage);

    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._renderColorUI();

    this._settingsId = this._settings.connect("changed::gnome-colors", () => {
      this._updateWallpaperUI();
    });

    this._bgChangedId1 = null;
    this._bgChangedId2 = null;
    this._colorSchemeId = null;

    this._settings.connect("changed::last-error", () => {
      const errorMsg = this._settings.get_string("last-error");

      if (errorMsg && errorMsg !== "") {
        const toast = new Adw.Toast({ title: _(errorMsg) });
        this._page.get_root().add_toast(toast);

        this._settings.set_string("last-error", "");
      }
    });

    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    const assetsPath = `${extensionDirPath}/assets`;
    iconTheme.add_search_path(assetsPath);

    const cssProvider = new Gtk.CssProvider();

    cssProvider.load_from_path(`${extensionDirPath}/prefs.css`);

    Gtk.StyleContext.add_provider_for_display(
      Gdk.Display.get_default(),
      cssProvider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    const accentGroup = new Adw.PreferencesGroup({
      title: _("Accent Color"),
    });
    this._page.add(accentGroup);

    accentGroup.set_visible(!this._settings.get_boolean("gnome-colors"));

    this._settings.connect("changed::gnome-colors", () => {
      accentGroup.set_visible(!this._settings.get_boolean("gnome-colors"));
    });

    const colorRow = new Adw.ActionRow({ title: _("Main color") });
    const colorButton = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      use_alpha: false,
    });
    colorRow.add_suffix(colorButton);
    accentGroup.add(colorRow);

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

    const wallpaperGroup = new Adw.PreferencesGroup();

    const updateGroupHeader = () => {
      const useGnomeColors = this._settings.get_boolean("gnome-colors");

      wallpaperGroup.set_title(
        !useGnomeColors ? _("Wallpaper Colors") : _("Accent Color"),
      );

      wallpaperGroup.set_description(
        !useGnomeColors
          ? _(
              "The system automatically updates the accent color based on your wallpaper.",
            )
          : "",
      );
    };

    updateGroupHeader();

    const settingsId = this._settings.connect("changed::gnome-colors", () =>
      updateGroupHeader(),
    );

    wallpaperGroup.connect("destroy", () => {
      this._settings.disconnect(settingsId);
    });

    this._page.add(wallpaperGroup);

    const previewRow = new Adw.PreferencesRow({
      activatable: false,
      focusable: false,
    });
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

    this._previewPicture = new Gtk.Picture({
      can_shrink: true,
      content_fit: Gtk.ContentFit.COVER,
      hexpand: true,
      halign: Gtk.Align.FILL,
      height_request: 200,
    });
    this._previewPicture.add_css_class("wallpaper-preview");
    this._previewContainer.append(this._previewPicture);

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
      focusable: false,
      selectable: false,
      child: this._moreColorBox,
    });

    this._moreColors.add_row(colorRowWrapper);
    this._colorsRow.set_child(this._mainColorBox);

    wallpaperGroup.add(this._colorsRow);
    wallpaperGroup.add(this._moreColors);

    const addButtonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
    });

    const iconButtonBox = new Gtk.Image({
      icon_name: "list-add-symbolic",
    });

    const labelButtonBox = new Gtk.Label({
      label: _("Add wallpapers"),
    });

    addButtonBox.append(iconButtonBox);
    addButtonBox.append(labelButtonBox);

    const addWallpapersButton = new Gtk.Button({
      child: addButtonBox,
    });

    addWallpapersButton.add_css_class("flat");
    addWallpapersButton.connect("clicked", () => this._onAddWallpaperClicked());

    const wallpapersListGroup = new Adw.PreferencesGroup({
      title: _("Wallpapers"),
      header_suffix: addWallpapersButton,
    });
    this._page.add(wallpapersListGroup);

    const wallpapersList = new Adw.PreferencesRow({
      activatable: false,
      focusable: false,
      selectable: false,
      margin_top: 8,
      margin_bottom: 8,
      margin_start: 8,
      margin_end: 8,
    });
    wallpapersListGroup.add(wallpapersList);

    this._containerUserWallpapers = new Gtk.FlowBox({
      orientation: Gtk.Orientation.HORIZONTAL,
      max_children_per_line: 2,
      min_children_per_line: 2,
      row_spacing: 8,
      column_spacing: 8,
    });

    this._containerSystemWallpapers = new Gtk.FlowBox({
      orientation: Gtk.Orientation.HORIZONTAL,
      max_children_per_line: 2,
      min_children_per_line: 2,
      row_spacing: 8,
      column_spacing: 8,
    });

    const wallpapersListContainer = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
    });

    wallpapersListContainer.append(this._containerUserWallpapers);
    wallpapersListContainer.append(
      new Gtk.Separator({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 12,
        margin_bottom: 12,
        hexpand: true,
      }),
    );
    wallpapersListContainer.append(this._containerSystemWallpapers);

    wallpapersList.set_child(wallpapersListContainer);

    const colorsGroup = new Adw.PreferencesGroup({
      title: _("Colors"),
    });
    this._optionsPage.add(colorsGroup);

    const gnomeColorsRow = new Adw.SwitchRow({
      title: _("GNOME Colors"),
      subtitle: _("Use native GNOME colors instead of wallpaper colors."),
    });
    colorsGroup.add(gnomeColorsRow);

    const preferLightRow = new Adw.SwitchRow({
      title: _("Prefer Light Style"),
      subtitle: _("Use a light style for the Shell in the light theme."),
    });
    colorsGroup.add(preferLightRow);

    this._settings.bind(
      "gnome-colors",
      gnomeColorsRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "prefer-light",
      preferLightRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const tintGnomeGroup = new Adw.PreferencesGroup({
      title: _("Tint GNOME"),
      description: _("Based on Tint my GNOME"),
    });
    this._optionsPage.add(tintGnomeGroup);

    const TintShellRow = new Adw.ExpanderRow({
      title: _("Tint Shell"),
      subtitle: _("Tints the GNOME Shell with the color of your choice."),
      show_enable_switch: true,
    });
    tintGnomeGroup.add(TintShellRow);

    const TintPanel = new Adw.SwitchRow({
      title: _("Tint Panel"),
      subtitle: _(
        'Keeping this disabled resolves issues with panel modifications in extensions such as "Blur My Shell" and "PaperWM".',
      ),
    });

    TintShellRow.add_row(TintPanel);

    TintShellRow.bind_property(
      "enable-expansion",
      TintShellRow,
      "expanded",
      GObject.BindingFlags.SYNC_CREATE,
    );

    const TintAppsRow = new Adw.ExpanderRow({
      title: _("Tint Apps"),
      subtitle: _(
        "Tints the LibAdwaita applications with the color of your choice.",
      ),
      show_enable_switch: true,
    });
    tintGnomeGroup.add(TintAppsRow);

    let msg = _(
      "Also tint the GTK3 apps (the {0} extension and the {1} theme are required to avoid bugs).",
    );

    let extension_link =
      '<a href="https://extensions.gnome.org/extension/4998/legacy-gtk3-theme-scheme-auto-switcher/">"Legacy (GTK3) Theme Scheme Auto Switcher"</a>';
    let theme_link =
      '<a href="https://github.com/lassekongo83/adw-gtk3">"adw-gtk3"</a>';

    let subtitle_gtk3 = msg
      .replace("{0}", extension_link)
      .replace("{1}", theme_link);

    const TintGTK3AppsRow = new Adw.SwitchRow({
      title: _("Tint GTK3 Apps"),
      subtitle: subtitle_gtk3,
    });

    TintAppsRow.add_row(TintGTK3AppsRow);

    TintAppsRow.bind_property(
      "enable-expansion",
      TintAppsRow,
      "expanded",
      GObject.BindingFlags.SYNC_CREATE,
    );

    const tintingStrengthStringList = Gtk.StringList.new([
      _("Subtle"),
      _("Default"),
      _("Strong"),
      _("Stronger"),
    ]);

    const TintingStrengthRow = new Adw.ComboRow({
      title: _("Tinting Strength"),
      subtitle: _("Determines the strength of the tint effect."),
      model: tintingStrengthStringList,
    });
    tintGnomeGroup.add(TintingStrengthRow);

    this._settings.bind(
      "tinting-strength",
      TintingStrengthRow,
      "selected",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const darkerRow = new Adw.SwitchRow({
      title: _("Darker Tint"),
      subtitle: _("Applies a darker tint."),
    });
    tintGnomeGroup.add(darkerRow);

    this._settings.bind(
      "tint-shell",
      TintShellRow,
      "enable-expansion",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "tint-panel",
      TintPanel,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "tint-apps",
      TintAppsRow,
      "enable-expansion",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "tint-gtk3",
      TintGTK3AppsRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "darker",
      darkerRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const iconThemeGroup = new Adw.PreferencesGroup({
      title: _("Icon Theme"),
    });
    this._optionsPage.add(iconThemeGroup);

    const iconThemeFolderRow = new Adw.ExpanderRow({
      title: _("Folder icon theme"),
      subtitle: _("Applies the accent color to folder icons."),
      show_enable_switch: true,
    });
    iconThemeGroup.add(iconThemeFolderRow);

    const iconThemeAppRow = new Adw.SwitchRow({
      title: _("Application icon theme"),
      subtitle: _("Applies the accent color to some app icons."),
    });

    const morewaitaRow = new Adw.SwitchRow({
      title: _("MoreWaita"),
      subtitle: _("Applies integration with the MoreWaita icon pack."),
    });

    iconThemeFolderRow.add_row(iconThemeAppRow);
    iconThemeFolderRow.add_row(morewaitaRow);

    this._settings.bind(
      "recolor-folders",
      iconThemeFolderRow,
      "enable-expansion",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "recolor-apps",
      iconThemeAppRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(
      "morewaita",
      morewaitaRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    iconThemeFolderRow.bind_property(
      "enable-expansion",
      iconThemeFolderRow,
      "expanded",
      GObject.BindingFlags.SYNC_CREATE,
    );

    const customCssGroup = new Adw.PreferencesGroup({
      title: _("Customization"),
    });
    this._optionsPage.add(customCssGroup);

    const customCssRow = new Adw.ActionRow({
      title: _("Custom stylesheet"),
      subtitle: _(
        "A file that overrides the CSS of the shell and user extensions, with support for ChromaLeon accent colors.",
      ),
    });

    const customCssSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
    });
    customCssRow.activatable_widget = customCssSwitch;

    this._settings.bind(
      "custom-css",
      customCssSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const infoButton = new Gtk.Button({
      valign: Gtk.Align.CENTER,
      icon_name: "help-about-symbolic",
      tooltip_text: _("About the custom stylesheet"),
    });
    infoButton.add_css_class("flat");

    const openCssButton = new Gtk.Button({
      valign: Gtk.Align.CENTER,
      child: new Gtk.Label({ label: _("Open file") }),
    });

    customCssRow.add_suffix(infoButton);
    customCssRow.add_suffix(openCssButton);
    customCssRow.add_suffix(customCssSwitch);
    customCssGroup.add(customCssRow);

    infoButton.connect("clicked", () => {
      const dialog = new Adw.MessageDialog({
        transient_for: window,
        heading: _("About the custom stylesheet"),
        body: _(
          "This file is used to apply custom CSS to GNOME Shell.\n\n" +
            "The extension processes all content within this file, replacing the <b><tt>@@ACCENT@@</tt></b> and <b><tt>-st-accent-color</tt></b> variables with the color selected in the ChromaLeon settings before applying them to the system. This can be useful if an extension does not have the accent colors applied correctly.\n\n" +
            "<b>Tip:</b> If your changes do not take effect, try adding <b><tt>!important</tt></b> to your CSS rules.",
        ),
        body_use_markup: true,
        close_response: "cancel",
      });
      dialog.add_response("close", _("Close"));
      dialog.connect("response", (d) => {
        d.destroy();
      });
      dialog.present();
    });

    openCssButton.connect("clicked", () => {
      const homeDir = GLib.get_home_dir();
      const file = Gio.File.new_for_path(
        `${homeDir}/.config/ChromaLeon/custom.css`,
      );
      const uri = file.get_uri();

      Gio.AppInfo.launch_default_for_uri_async(
        uri,
        null,
        null,
        (source, result) => {
          try {
            Gio.AppInfo.launch_default_for_uri_finish(result);
          } catch (error) {
            throw new Error(_("Failed to open custom.css: " + error.message));
          }
        },
      );
    });

    const miscellaneousGroup = new Adw.PreferencesGroup({
      title: _("Miscellaneous"),
    });
    this._optionsPage.add(miscellaneousGroup);

    const flatpakRow = new Adw.SwitchRow({
      title: _("Apply to Flatpaks"),
      subtitle: _(
        "Allow Flatpaks to access your custom accent color variables.",
      ),
    });
    miscellaneousGroup.add(flatpakRow);

    const shortcutRow = new Adw.SwitchRow({
      title: _("Enable shortcut"),
      subtitle: _(
        "Create a shortcut in the app grid by adding a .desktop file.",
      ),
    });
    miscellaneousGroup.add(shortcutRow);

    this._settings.bind(
      "create-shortcut",
      shortcutRow,
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

    flatpakRow.set_active(checkFlatpakPermissions());
    flatpakRow.connect("notify::active", () => {
      const isActive = flatpakRow.get_active();
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
        Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
      });
    });

    this._applyTheme = () => {
      const hex = this._settings.get_string("accent-color");
      const rgba = new Gdk.RGBA();
      rgba.parse(hex);
      colorButton.set_rgba(rgba);

      colorRow.set_subtitle(hex);

      if (this._wallpaperButtons) {
        this._wallpaperButtons.forEach((item) => item.updateStyle(hex));
      }
    };

    this._applyTheme();

    this._loadWallpapersAsync();
    this._updateWallpaperUI();

    this._colorSchemeId = this._interfaceSettings.connect(
      "changed::color-scheme",
      () => {
        this._updateWallpaperUI();
      },
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

  async _deleteWallpaper(filename) {
    const file = Gio.File.new_for_path(
      `${GLib.get_user_data_dir()}/backgrounds/${filename}`,
    );

    if (!file.query_exists(null)) return;

    try {
      await file.delete_async(GLib.PRIORITY_DEFAULT, null);

      const toast = new Adw.Toast({
        title: _("Wallpaper deleted successfully!"),
      });
      this._page.get_root().add_toast(toast);
    } catch (e) {
      throw new Error(_("Error deleting wallpaper: " + e.message));
    }
  }

  _onAddWallpaperClicked() {
    const fileChooser = new Gtk.FileChooserNative({
      title: _("Select a Wallpaper"),
      action: Gtk.FileChooserAction.OPEN,
      accept_label: _("_Open"),
      cancel_label: _("_Cancel"),
      transient_for: this._page.get_root(),
    });

    const filter = new Gtk.FileFilter();
    filter.set_name(_("All Images"));
    filter.add_mime_type("image/*");
    fileChooser.add_filter(filter);

    fileChooser.connect("response", (dialog, response) => {
      if (response === Gtk.ResponseType.ACCEPT) {
        const file = dialog.get_file();
        this._copyWallpaperToUserDir(file);
      }
      dialog.destroy();
    });

    fileChooser.show();
  }

  _copyWallpaperToUserDir(sourceFile) {
    const destDir = Gio.File.new_for_path(
      `${GLib.get_user_data_dir()}/backgrounds`,
    );

    if (!destDir.query_exists(null)) {
      destDir.make_directory_with_parents(null);
    }

    const destFile = destDir.get_child(sourceFile.get_basename());

    if (destFile.query_exists(null)) {
      const toast = new Adw.Toast({ title: _("Wallpaper already exists!") });
      this._page.get_root().add_toast(toast);
      return;
    }

    sourceFile.copy_async(
      destFile,
      Gio.FileCopyFlags.OVERWRITE,
      GLib.PRIORITY_DEFAULT,
      null,
      null,
      (source, res) => {
        try {
          source.copy_finish(res);
          this._loadWallpapersAsync();
          const toast = new Adw.Toast({
            title: _("Wallpaper added successfully!"),
          });
          this._page.get_root().add_toast(toast);
        } catch (e) {
          throw new Error(_("Error copying wallpaper: " + e.message));
        }
      },
    );
  }

  async _readXmlProperties(xmlFile) {
    try {
      const parseSlideshowXml = async (filePath) => {
        try {
          const file = Gio.File.new_for_path(filePath);
          if (!file.query_exists(null)) return null;

          const [contents] = await file.load_contents_async(null);
          const xmlText = new TextDecoder().decode(contents);

          const matches = [
            ...xmlText.matchAll(
              /<static>[\s\S]*?<file>(.*?)<\/file>[\s\S]*?<\/static>/g,
            ),
          ];

          if (matches.length > 0) {
            const files = matches.map((m) => m[1].trim());
            return {
              light: files[0],
              dark: files[Math.floor(files.length / 2)] || files[0],
            };
          }
        } catch (e) {
          return null;
        }
        return null;
      };

      const [contents] = await xmlFile.load_contents_async(null);
      const xmlText = new TextDecoder().decode(contents);
      const wallpapers = [];

      const blocks = xmlText.split("<wallpaper");

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];

        let nameMatch = block.match(/<_?name[^>]*>(.*?)<\/_?name>/);
        let lightMatch = block.match(/<filename[^>]*>(.*?)<\/filename>/);
        let darkMatch = block.match(
          /<filename-dark[^>]*>(.*?)<\/filename-dark>/,
        );

        let pathLight = lightMatch ? lightMatch[1].trim() : null;
        let pathDark = darkMatch ? darkMatch[1].trim() : null;

        if (!pathLight) continue;

        const isSlideshow = pathLight.toLowerCase().endsWith(".xml");

        if (isSlideshow) {
          const slideshow = await parseSlideshowXml(pathLight);
          if (slideshow) {
            pathLight = slideshow.light;
            pathDark = pathDark || slideshow.dark;
          } else {
            continue;
          }
        }

        wallpapers.push({
          name: nameMatch ? nameMatch[1] : "",
          pathLight,
          pathDark,
          thumbLight: await getThumbnail(pathLight),
          thumbDark: pathDark
            ? await getThumbnail(pathDark)
            : await getThumbnail(pathLight),
          slideshow: isSlideshow,
        });
      }

      return wallpapers;
    } catch (e) {
      return [];
    }
  }

  async _loadWallpapersAsync() {
    const dirUser = Gio.File.new_for_path(
      `${GLib.get_user_data_dir()}/backgrounds`,
    );

    if (dirUser.query_exists(null)) {
      const iter = await dirUser.enumerate_children_async(
        "standard::name,time::modified",
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        GLib.PRIORITY_DEFAULT,
        null,
      );

      let userWallpapers = [];

      while (true) {
        const fileInfos = await iter.next_files_async(
          10,
          GLib.PRIORITY_DEFAULT,
          null,
        );
        if (fileInfos.length === 0) break;

        for (const fileInfo of fileInfos) {
          const fileChild = dirUser.get_child(fileInfo.get_name());

          userWallpapers.push({
            name: fileInfo.get_name(),
            path: fileChild.get_path(),
            thumbnail: await getThumbnail(fileChild.get_path()),
            mtime: fileInfo.get_attribute_uint64("time::modified"),
          });
        }
      }

      userWallpapers.sort((a, b) => b.mtime - a.mtime);

      userWallpapers.forEach((file, index) => {
        const child = new Gtk.FlowBoxChild({
          focusable: true,
          can_focus: true,
        });

        const overlay = new Gtk.Overlay();
        overlay.add_css_class("wallpaper-overlay");

        const cardBox = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          height_request: 125,
          homogeneous: true,
          overflow: Gtk.Overflow.HIDDEN,
        });
        cardBox.add_css_class("wallpaper-preview");

        const preview = new Gtk.Picture({
          file: Gio.File.new_for_path(file.thumbnail),
          height_request: 125,
          content_fit: Gtk.ContentFit.COVER,
          can_shrink: true,
          hexpand: true,
        });
        cardBox.append(preview);
        overlay.set_child(cardBox);

        const deleteBtn = new Gtk.Button({
          icon_name: "user-trash-symbolic",
          halign: Gtk.Align.END,
          valign: Gtk.Align.START,
          margin_top: 8,
          margin_end: 8,
        });
        deleteBtn.add_css_class("error");
        deleteBtn.add_css_class("circular");
        deleteBtn.add_css_class("deleteBtn");

        const gesture = new Gtk.GestureClick();
        gesture.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        gesture.connect("released", (gesture) => {
          gesture.set_state(Gtk.EventSequenceState.CLAIMED);
          this._deleteWallpaper(file.name);
          this._containerUserWallpapers.remove(child);
        });
        deleteBtn.add_controller(gesture);
        overlay.add_overlay(deleteBtn);
        child.set_child(overlay);

        const fileUri = `${GLib.get_user_data_dir()}/backgrounds/${file.name}`;

        child.wallpaperUri = fileUri;
        this._containerUserWallpapers.insert(child, -1);
      });

      this._containerUserWallpapers.connect(
        "child-activated",
        (flowbox, child) => {
          const fileUri = child.wallpaperUri;

          if (fileUri) {
            const uriWithProtocol = Gio.File.new_for_path(fileUri).get_uri();
            this._bgSettings.set_string("picture-uri-dark", uriWithProtocol);
            this._bgSettings.set_string("picture-uri", uriWithProtocol);
          }
        },
      );
    }

    const systemDirs = GLib.get_system_data_dirs();
    let systemXmlDir = null;

    for (const dir of systemDirs) {
      const testPath = Gio.File.new_for_path(
        `${dir}/gnome-background-properties`,
      );
      if (testPath.query_exists(null)) {
        systemXmlDir = testPath;
        break;
      }
    }

    if (!systemXmlDir) {
      systemXmlDir = Gio.File.new_for_path(
        "/usr/share/gnome-background-properties",
      );
    }

    if (systemXmlDir.query_exists(null)) {
      const iter = await systemXmlDir.enumerate_children_async(
        "standard::name",
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        GLib.PRIORITY_DEFAULT,
        null,
      );

      let systemWallpapers = [];

      while (true) {
        const fileInfos = await iter.next_files_async(
          10,
          GLib.PRIORITY_DEFAULT,
          null,
        );
        if (fileInfos.length === 0) break;

        for (const fileInfo of fileInfos) {
          const name = fileInfo.get_name();

          if (name.endsWith(".xml")) {
            const xmlFile = systemXmlDir.get_child(name);
            const dynamicWallpapers = await this._readXmlProperties(xmlFile);
            systemWallpapers.push(...dynamicWallpapers);
          }
        }
      }

      systemWallpapers.forEach((file) => {
        const child = new Gtk.FlowBoxChild({
          focusable: true,
          can_focus: true,
        });

        const overlay = new Gtk.Overlay();
        overlay.add_css_class("wallpaper-overlay");

        const cardBox = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          height_request: 125,
          homogeneous: true,
          overflow: Gtk.Overflow.HIDDEN,
          can_target: false,
        });
        cardBox.add_css_class("wallpaper-preview");
        overlay.set_child(cardBox);

        if (file.slideshow) {
          const clockIcon = new Gtk.Image({
            icon_name: "clock-alt-symbolic",
            halign: Gtk.Align.END,
            valign: Gtk.Align.END,
            margin_bottom: 8,
            margin_end: 8,
          });
          overlay.add_overlay(clockIcon);
        }

        try {
          const pbLight = GdkPixbuf.Pixbuf.new_from_file(file.thumbLight);
          const w = Math.floor(pbLight.get_width() / 2);

          cardBox.append(
            new Gtk.Picture({
              paintable: Gdk.Texture.new_for_pixbuf(
                pbLight.new_subpixbuf(0, 0, w, pbLight.get_height()),
              ),
              can_shrink: true,
              content_fit: Gtk.ContentFit.COVER,
              hexpand: true,
              vexpand: true,
            }),
          );

          const darkPath = file.pathDark ? file.thumbDark : file.thumbLight;
          const pbDark = GdkPixbuf.Pixbuf.new_from_file(darkPath);
          const dw = Math.floor(pbDark.get_width() / 2);

          cardBox.append(
            new Gtk.Picture({
              paintable: Gdk.Texture.new_for_pixbuf(
                pbDark.new_subpixbuf(dw, 0, dw, pbDark.get_height()),
              ),
              can_shrink: true,
              content_fit: Gtk.ContentFit.COVER,
              hexpand: true,
              vexpand: true,
            }),
          );
        } catch (e) {
          cardBox.append(
            new Gtk.Picture({
              file: Gio.File.new_for_path(file.thumbLight),
              can_shrink: true,
              content_fit: Gtk.ContentFit.COVER,
            }),
          );
        }

        child.set_child(overlay);
        const systemUris = {
          dark: Gio.File.new_for_path(
            file.pathDark || file.pathLight,
          ).get_uri(),
          light: Gio.File.new_for_path(file.pathLight).get_uri(),
        };

        child.wallpaperUris = systemUris;
        this._containerSystemWallpapers.insert(child, -1);
      });

      this._containerSystemWallpapers.connect(
        "child-activated",
        (flowbox, child) => {
          const uris = child.wallpaperUris;

          if (uris) {
            this._bgSettings.set_string("picture-uri-dark", uris.dark);
            this._bgSettings.set_string("picture-uri", uris.light);
          }
        },
      );
    }
  }

  async _updateWallpaperUI() {
    if (!this._previewContainer) return;

    let colorScheme = this._interfaceSettings.get_string("color-scheme");
    let uri =
      colorScheme === "prefer-dark"
        ? this._bgSettings.get_string("picture-uri-dark")
        : this._bgSettings.get_string("picture-uri");

    if (uri && !uri.startsWith("file://") && uri.startsWith("/")) {
      uri = Gio.File.new_for_path(uri).get_uri();
    }

    if (uri && uri.startsWith("file://")) {
      try {
        let file = Gio.File.new_for_uri(uri);
        let path = file.get_path();

        if (path.endsWith(".xml")) {
          path = await getThumbnail(path);
        }

        if (path && !path.endsWith(".xml")) {
          const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
            path,
            747,
            420,
            true,
          );

          const texture = Gdk.Texture.new_for_pixbuf(pixbuf);

          if (this._previewPicture) {
            this._previewPicture.set_paintable(texture);
          }
        }
      } catch (e) {
        throw new Error(`Error rendering preview: ${e.message}`);
      }
    }

    await this._renderColorUI(uri);
  }

  async _getColorsList(uri) {
    const colorsGnome = [
      "blue",
      "teal",
      "green",
      "yellow",
      "orange",
      "red",
      "pink",
      "purple",
      "slate",
    ];

    if (this._settings.get_boolean("gnome-colors")) {
      return colorsGnome;
    }

    try {
      let activeUri = uri;
      if (!activeUri) {
        const colorScheme = this._interfaceSettings.get_string("color-scheme");
        activeUri =
          colorScheme === "prefer-dark"
            ? this._bgSettings.get_string("picture-uri-dark")
            : this._bgSettings.get_string("picture-uri");
      }

      if (
        activeUri &&
        !activeUri.startsWith("file://") &&
        activeUri.startsWith("/")
      ) {
        activeUri = Gio.File.new_for_path(activeUri).get_uri();
      }

      return await this._getWallpaperColorsAsync(activeUri);
    } catch (e) {
      return [];
    }
  }

  async _renderColorUI(uri) {
    const colors = await this._getColorsList(uri);

    if (this._mainColorBox) {
      while (this._mainColorBox.get_first_child()) {
        this._mainColorBox.remove(this._mainColorBox.get_first_child());
      }
    }
    if (this._moreColorBox) {
      while (this._moreColorBox.get_first_child()) {
        this._moreColorBox.remove(this._moreColorBox.get_first_child());
      }
    }

    if (!colors || colors.length === 0) {
      this._colorsRow.set_subtitle(_("Unable to load colors."));
      this._moreColors.set_visible(false);
      return;
    }

    this._colorsRow.set_subtitle("");
    this._wallpaperButtons = [];
    this._moreColors.set_visible(colors.length > 9);

    let isGnomeColor = this._settings.get_boolean("gnome-colors");
    let currentColor = isGnomeColor
      ? this._interfaceSettings.get_string("accent-color")
      : this._settings.get_string("accent-color");

    if (
      !colors.includes(currentColor) &&
      !this._settings.get_boolean("custom-color")
    ) {
      if (isGnomeColor) {
        this._interfaceSettings.set_string("accent-color", colors[0]);
      } else {
        this._settings.set_string("accent-color", colors[0]);
      }
    }

    this._applyTheme();

    colors.forEach((hexColor, index) => {
      let btn = new Gtk.Button({
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
      });

      let cssProvider = new Gtk.CssProvider();

      const updateButtonStyle = () => {
        let color = isGnomeColor ? `var(--accent-${hexColor})` : hexColor;

        const isActive = isGnomeColor
          ? this._interfaceSettings.get_string("accent-color") === hexColor
          : this._settings.get_string("accent-color") === hexColor;

        let cssString = isActive
          ? `button {
                  background-color: ${color};
                  min-width: 20px;
                  min-height: 20px;
                  border-radius: 50%;
                  padding: 0;
                  margin: 5px;
                  outline: 3px solid ${color};
                  outline-offset: 3px;
                }
                button:focus {
                  outline: 3px solid alpha(${color}, 0.6);
                }`
          : `button {
                  background-color: ${color};
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
                  outline: 3px solid alpha(${color}, 0.6);
                  outline-offset: 3px;
                }`;

        if (cssProvider.load_from_string)
          cssProvider.load_from_string(cssString);
        else cssProvider.load_from_data(cssString, -1);
      };

      updateButtonStyle();

      this._wallpaperButtons.push({ updateStyle: updateButtonStyle });

      btn
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      btn.connect("clicked", () => {
        if (isGnomeColor)
          this._interfaceSettings.set_string("accent-color", hexColor);
        this._settings.set_string("accent-color", hexColor);
        this._settings.set_boolean("custom-color", true);
        this._applyTheme();
      });

      if (index < 9) {
        this._mainColorBox.append(btn);
      } else {
        this._moreColorBox.append(btn);
      }
    });
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

    const toHex = (val) =>
      Math.round(val * 255)
        .toString(16)
        .padStart(2, "0");

    for (let color of vibrantRanking) {
      let { r, g, b } = hslToRgb(color.h, color.s, color.l);
      let luminance = _getRelativeLuminance(r, g, b);
      let l = color.l;

      if (_getContrastRatio(luminance, 0.91) < 3) {
        while (_getContrastRatio(luminance, 0.91) <= 3) {
          l--;
          let rgb = hslToRgb(color.h, color.s, l);
          luminance = _getRelativeLuminance(rgb.r, rgb.g, rgb.b);
        }

        if (_getContrastRatio(luminance, 0.91) < 3) {
          continue;
        }

        color.l = l;
        const finalRgb = hslToRgb(color.h, color.s, color.l);
        color.hex = `#${toHex(finalRgb.r)}${toHex(finalRgb.g)}${toHex(finalRgb.b)}`;
      }

      if (!isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    let frequencyRanking = [...colorsList].sort((a, b) => b.count - a.count);
    for (let color of frequencyRanking) {
      let { r, g, b } = hslToRgb(color.h, color.s, color.l);
      let luminance = _getRelativeLuminance(r, g, b);
      let l = color.l;

      if (_getContrastRatio(luminance, 0.91) < 3) {
        while (_getContrastRatio(luminance, 0.91) <= 3) {
          l--;
          let rgb = hslToRgb(color.h, color.s, l);
          luminance = _getRelativeLuminance(rgb.r, rgb.g, rgb.b);
        }

        if (_getContrastRatio(luminance, 0.91) < 3) {
          continue;
        }

        color.l = l;
        const finalRgb = hslToRgb(color.h, color.s, color.l);
        color.hex = `#${toHex(finalRgb.r)}${toHex(finalRgb.g)}${toHex(finalRgb.b)}`;
      }

      if (!finalColors.includes(color.hex) && !isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    return finalColors.slice(0, 60);
  }
}

function setupCustomHeader(window) {
  window.search_enabled = true;

  const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(`${GLib.get_current_dir()}/assets`);

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 6,
  });

  const donateIcon = Gtk.Image.new_from_icon_name("heart-filled-symbolic");
  donateIcon.add_css_class("symbolic");
  const label = new Gtk.Label({ label: _("Support") });

  box.append(donateIcon);
  box.append(label);

  const donateButton = new Gtk.Button({
    valign: Gtk.Align.CENTER,
    child: box,
  });

  donateButton.add_css_class("destructive");
  donateButton.add_css_class("heart-button");
  donateButton.set_tooltip_text(_("Support the project"));

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

export function buildUI(window, page, settings) {
  setupCustomHeader(window);
  new ChromaLeonUI(window, page, settings);
}

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  GLib.set_application_name("ChromaLeon");

  const app = new Adw.Application({
    application_id: "com.github.fabito02.chromaleon",
  });

  app.connect("activate", (app) => {
    const window = new Adw.PreferencesWindow({ application: app });
    window.set_default_size(600, 680);
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
