/*
 * wallpaperPage.js
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
import GnomeDesktop from "gi://GnomeDesktop?version=4.0";
import {
  rgbToHsl,
  _getRelativeLuminance,
  _getContrastRatio,
  _adjustContrast,
  toHex,
} from "../utils/colorUtils.js";
import { throwIfCancelled, isCancelledError } from "../utils/cancellation.js";
import { getColorCache, writeColorCacheFile } from "../utils/cacheUtils.js";

const _ = (str) => {
  try {
    return Gettext.dgettext("chromaleon", str);
  } catch (e) {
    return str;
  }
};

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

export class WallpaperPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor(settings, bgSettings, interfaceSettings) {
    super({
      title: _("Wallpaper"),
      icon_name: "image-round-symbolic",
    });

    this.add_css_class("symbolic");

    this._settings = settings;
    this._bgSettings = bgSettings;
    this._interfaceSettings = interfaceSettings;

    this._manualColor = false;
    this._cancellable = null;
    this._opChain = Promise.resolve();
    this._bgUpdateTimeoutId = null;

    this._buildUI();
    this._setupSignals();

    this._loadWallpapersAsync();
    this._runOperation(async (cancellable) => {
      await this._updateWallpaperUI(cancellable);
    });
  }

  _buildUI() {
    const wallpaperGroup = new Adw.PreferencesGroup();

    this.add(wallpaperGroup);

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
    this.add(wallpapersListGroup);

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
  }

  _setupSignals() {
    this._settingsId = this._settings.connect("changed::gnome-colors", () => {
      this._runOperation(async (cancellable) => {
        await this._updateWallpaperUI(cancellable);
      });
    });

    this._lastErrorId = this._settings.connect("changed::last-error", () => {
      const errorMsg = this._settings.get_string("last-error");
      if (errorMsg && errorMsg !== "") {
        const toast = new Adw.Toast({ title: _(errorMsg) });
        this.get_root()?.add_toast(toast);
        this._settings.set_string("last-error", "");
      }
    });

    const handleBgChange = () => {
      this._runOperation(async (cancellable) => {
        await this._updateWallpaperUI(cancellable);
      });
    };

    this._bgChangedId1 = this._bgSettings.connect(
      "changed::picture-uri-dark",
      handleBgChange,
    );
    this._bgChangedId2 = this._bgSettings.connect(
      "changed::picture-uri",
      handleBgChange,
    );
    this._colorSchemeId = this._interfaceSettings.connect(
      "changed::color-scheme",
      handleBgChange,
    );

    this.connect("destroy", () => this._onDestroy());
  }

  _onDestroy() {
    if (this._settingsId) this._settings.disconnect(this._settingsId);
    if (this._lastErrorId) this._settings.disconnect(this._lastErrorId);
    if (this._bgChangedId1) this._bgSettings.disconnect(this._bgChangedId1);
    if (this._bgChangedId2) this._bgSettings.disconnect(this._bgChangedId2);
    if (this._colorSchemeId)
      this._interfaceSettings.disconnect(this._colorSchemeId);

    if (this._bgUpdateTimeoutId) {
      GLib.Source.remove(this._bgUpdateTimeoutId);
      this._bgUpdateTimeoutId = null;
    }

    this._cancellable?.cancel();
    this._cancellable = null;
    this._opChain = Promise.resolve();
  }

  _applyTheme() {
    const hex = this._settings.get_string("accent-color");
    const rgba = new Gdk.RGBA();
    rgba.parse(hex);

    if (this._manualColorBtn) {
      if (this._manualColor) {
        this._manualColorBtn.add_css_class("active");
      } else {
        this._manualColorBtn.remove_css_class("active");
      }
    }

    if (this._wallpaperButtons) {
      this._wallpaperButtons.forEach((item) => item.updateStyle(hex));
    }
  }

  _setWallpaper(uriDark, uriLight) {
    if (this._bgUpdateTimeoutId) {
      GLib.Source.remove(this._bgUpdateTimeoutId);
      this._bgUpdateTimeoutId = null;
    }

    this._bgUpdateTimeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      300,
      () => {
        this._bgSettings.delay();
        this._bgSettings.set_string("picture-uri-dark", uriDark);
        this._bgSettings.set_string("picture-uri", uriLight);
        this._bgSettings.apply();

        this._bgUpdateTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  _runOperation(fn) {
    this._cancellable?.cancel();

    const cancellable = new Gio.Cancellable();
    this._cancellable = cancellable;

    this._opChain = this._opChain
      .catch(() => {})
      .then(async () => {
        if (cancellable.is_cancelled()) return;

        try {
          await fn(cancellable);
        } catch (e) {
          if (!isCancelledError(e)) {
            this._settings?.set_string("last-error", e.message ?? String(e));
          }
        } finally {
          if (this._cancellable === cancellable) {
            this._cancellable = null;
          }
        }
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
      this.get_root()?.add_toast(toast);
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
      transient_for: this.get_root(),
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
      this.get_root()?.add_toast(toast);
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
          this.get_root()?.add_toast(toast);
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

      userWallpapers.forEach((file) => {
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
            this._setWallpaper(uriWithProtocol, uriWithProtocol);
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
            this._setWallpaper(uris.dark, uris.light);
          }
        },
      );
    }
  }

  async _updateWallpaperUI(cancellable = null) {
    if (!this._previewContainer) return;
    throwIfCancelled(cancellable);

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

        throwIfCancelled(cancellable);

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
        if (!isCancelledError(e)) {
          throw new Error(`Error rendering preview: ${e.message}`);
        }
        throw e;
      }
    }

    await this._renderColorUI(uri, cancellable);
  }

  async _getColorsList(uri, cancellable = null) {
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

      return await this._getWallpaperColorsAsync(activeUri, cancellable);
    } catch (e) {
      if (isCancelledError(e)) throw e;
      return [];
    }
  }

  async _renderColorUI(uri, cancellable = null) {
    if (!uri) {
      const colorScheme = this._interfaceSettings.get_string("color-scheme");
      uri =
        colorScheme === "prefer-dark"
          ? this._bgSettings.get_string("picture-uri-dark")
          : this._bgSettings.get_string("picture-uri");

      if (uri && !uri.startsWith("file://") && uri.startsWith("/")) {
        uri = Gio.File.new_for_path(uri).get_uri();
      }
    }

    let colors = [];
    const isGnomeColor = this._settings.get_boolean("gnome-colors");
    let cached = null;

    if (isGnomeColor) {
      colors = await this._getColorsList(uri, cancellable);
    } else {
      const colorCache = await getColorCache(cancellable);
      cached = uri ? colorCache[uri] : null;

      if (cached?.all_colors) {
        colors = cached.all_colors;
      } else {
        colors = await this._getColorsList(uri, cancellable);

        if (colors && colors.length > 0 && uri) {
          await writeColorCacheFile(uri, { all_colors: colors }, cancellable);
        }
      }
    }

    throwIfCancelled(cancellable);

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

    const maxMainColors = isGnomeColor ? colors.length : 8;
    this._moreColors.set_visible(colors.length > maxMainColors);

    let currentColor = isGnomeColor
      ? this._interfaceSettings.get_string("accent-color")
      : this._settings.get_string("accent-color");

    if (!isGnomeColor) {
      if (cached?.persistentColor) {
        currentColor = cached.persistentColor;
        if (this._settings.get_string("accent-color") !== currentColor) {
          this._settings.set_string("accent-color", currentColor);
        }
      } else if (!colors.includes(currentColor)) {
        currentColor = colors[0];
        this._settings.set_string("accent-color", currentColor);
        if (uri) {
          await writeColorCacheFile(
            uri,
            { persistentColor: currentColor },
            cancellable,
          );
        }
      }

      this._manualColor = !colors.includes(currentColor);
    } else {
      this._manualColor = false;
      if (!colors.includes(currentColor)) {
        currentColor = colors[0];
        this._interfaceSettings.set_string("accent-color", currentColor);
      }
    }

    const iconEdit = new Gtk.Image({
      icon_name: "edit-color-symbolic",
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    this._manualColorBtn = new Gtk.Button({
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      child: iconEdit,
    });

    this._manualColorBtn.add_css_class("custom-color-btn");

    if (this._manualColor) {
      this._manualColorBtn.add_css_class("active");
    } else {
      this._manualColorBtn.remove_css_class("active");
    }

    const colorDialog = new Gtk.ColorDialog({
      with_alpha: false,
      title: _("Select Color"),
    });

    this._manualColorBtn.connect("clicked", () => {
      const currentHex = this._settings.get_string("accent-color");
      const initialRgba = new Gdk.RGBA();
      initialRgba.parse(currentHex || "#3584e4");

      colorDialog.choose_rgba(
        this.get_root(),
        initialRgba,
        null,
        async (dialog, res) => {
          let rgba;
          try {
            rgba = dialog.choose_rgba_finish(res);
          } catch (e) {
            return;
          }

          if (!rgba) return;

          const hex = `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
          this._manualColor = true;
          this._settings.set_string("accent-color", hex);
          this._settings.set_boolean("custom-color", true);

          if (uri) {
            await writeColorCacheFile(
              uri,
              { persistentColor: hex },
              cancellable,
            );
          }

          this._applyTheme();

          this._runOperation(async (cancellable) => {
            await this._renderColorUI(uri, cancellable);
          });
        },
      );
    });

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
          : !this._manualColor &&
            this._settings.get_string("accent-color") === hexColor;

        let cssString = isActive
          ? `button, 
               button:active, 
               button:focus:active { 
                   background-color: ${color}; 
                   min-width: 20px; 
                   min-height: 20px; 
                   border-radius: 50%; 
                   margin: 6px; 
                   border: none; 
                   padding: 0px; 
                   outline: 3px solid ${color}; 
                   outline-offset: 3px; 
                   box-shadow: none; 
                 } 
                 button:focus { 
                   outline: 3px solid alpha(${color}, 0.7); 
                   outline-offset: 3px; 
                 }`
          : `button, 
               button:active, 
               button:focus:active { 
                   background-color: ${color}; 
                   min-width: 32px; 
                   min-height: 32px; 
                   border-radius: 50%; 
                   margin: 0px; 
                   border: none; 
                   padding: 0px; 
                   outline: none; 
                   box-shadow: none; 
                 } 
                 button:focus { 
                   min-width: 20px; 
                   min-height: 20px; 
                   margin: 6px; 
                   border: none; 
                   padding: 0px; 
                   outline: 3px solid alpha(${color}, 0.7); 
                   outline-offset: 3px; 
                   box-shadow: none; 
                 }`;
        cssProvider.load_from_string(cssString);
      };

      updateButtonStyle();
      this._wallpaperButtons.push({ updateStyle: updateButtonStyle });

      btn
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      btn.connect("clicked", async () => {
        this._manualColor = false;
        this._settings.set_boolean("custom-color", true);

        if (uri) {
          await writeColorCacheFile(
            uri,
            { persistentColor: hexColor },
            cancellable,
          );
        }

        if (isGnomeColor) {
          this._interfaceSettings.set_string("accent-color", hexColor);
        } else {
          this._settings.set_string("accent-color", hexColor);
        }

        this._applyTheme();
      });

      if (index < maxMainColors) {
        this._mainColorBox.append(btn);
      } else {
        this._moreColorBox.append(btn);
      }
    });

    if (!isGnomeColor) {
      this._mainColorBox.append(this._manualColorBtn);
    }

    this._applyTheme();
  }

  _getWallpaperColorsAsync(uri, cancellable = null) {
    return new Promise((resolve, reject) => {
      if (!uri || !uri.startsWith("file://")) {
        resolve([]);
        return;
      }

      if (cancellable && cancellable.is_cancelled()) {
        reject(
          new GLib.Error(
            Gio.IOErrorEnum,
            Gio.IOErrorEnum.CANCELLED,
            "Operation superseded by a newer request",
          ),
        );
        return;
      }

      let file = Gio.File.new_for_uri(uri);

      file.read_async(GLib.PRIORITY_DEFAULT, cancellable, (source, res) => {
        try {
          let stream = source.read_finish(res);

          GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
            stream,
            64,
            64,
            true,
            cancellable,
            (obj, asyncRes) => {
              try {
                let pixbuf = GdkPixbuf.Pixbuf.new_from_stream_finish(asyncRes);
                stream.close_async(GLib.PRIORITY_DEFAULT, null, () => {});

                throwIfCancelled(cancellable);

                let finalColors = this._extractColorsFromPixbuf(pixbuf);
                resolve(finalColors);
              } catch (e) {
                if (isCancelledError(e)) reject(e);
                else resolve([]);
              }
            },
          );
        } catch (e) {
          if (isCancelledError(e)) reject(e);
          else resolve([]);
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
      _adjustContrast(color);

      if (!finalColors.includes(color.hex) && !isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    let frequencyRanking = [...colorsList].sort((a, b) => b.count - a.count);
    for (let color of frequencyRanking) {
      _adjustContrast(color);

      if (!finalColors.includes(color.hex) && !isTooSimilarToExisting(color)) {
        finalColors.push(color.hex);
        usedColorsData.push({ h: color.h, s: color.s, l: color.l });
      }
    }

    return finalColors.slice(0, 60);
  }
}
