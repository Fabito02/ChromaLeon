/*
 * extension.js
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

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { sessionMode } from "resource:///org/gnome/shell/ui/main.js";
import * as ColorUtils from "./utils/colorUtils.js";
import * as FileUtils from "./utils/fileUtils.js";
import * as ThemeUtils from "./utils/themeUtils.js";
import { clearRecolorTimeout } from "./utils/recolorUtils.js";

export default class CustomAccentExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._bgSettings = null;
    this._interfaceSettings = null;
    this._generatedCssFile = null;
    this._configId = null;
    this._timeoutId = null;
    this._a11ySettings = null;
  }

  enable() {
    this._settings = this.getSettings();

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    this._a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.interface",
    });

    (async () => {
      try {
        await this._autoApplyWallpaperColor();
      } catch (e) {
        throw new Error(_("Failed to apply custom style: " + e.message));
      }
    })();

    this._settings.connectObject(
      "changed::accent-color",
      async () =>
        this._settings.get_boolean("recolor-folders")
          ? await this._updateStyles(true, true)
          : await this._updateStyles(false, true),
      "changed::gnome-colors",
      async () => {
        if (!this._settings.get_boolean("gnome-colors")) {
          this._settings.set_boolean("custom-color", false);
        } else {
          this._reloadGtkStylesheet()
        }
        await this._autoApplyWallpaperColor();
        await this._updateIconPack();
      },
      "changed::tint-shell",
      async () => await this._updateShellStyles(),
      "changed::custom-css",
      async () => await this._updateShellStyles(),
      "changed::tint-apps",
      async () => await this._updateAppStyles(),
      "changed::tint-gtk3",
      async () => await this._updateAppStyles(),
      "changed::darker",
      async () => await this._updateStyles(false, true),
      "changed::recolor-folders",
      async () => await this._updateIconPack(),
      "changed::recolor-apps",
      async () => await this._updateIconPack(),
      "changed::morewaita",
      async () => await this._updateIconPack(),
      this,
    );

    this._interfaceSettings.connectObject(
      "changed::color-scheme",
      async () => {
        await this._autoApplyWallpaperColor();
      },
      "changed::accent-color",
      async () => {
        if (this._settings.get_boolean("gnome-colors")) {
          const newAccent = this._interfaceSettings.get_string("accent-color");

          if (this._settings.get_string("accent-color") !== newAccent) {
            this._settings.set_string("accent-color", newAccent);
          }
        }
      },
      this,
    );

    this._bgSettings.connectObject(
      "changed::picture-uri-dark",
      async () => {
        this._settings.set_boolean("custom-color", false);
        await this._autoApplyWallpaperColor();
      },
      "changed::picture-uri",
      async () => {
        this._settings.set_boolean("custom-color", false);
        await this._autoApplyWallpaperColor();
      },
      this,
    );

    this._configId = this._settings.connect("changed::create-shortcut", () => {
      this._updateDesktopFile();
    });

    if (
      this._interfaceSettings.get_string("icon-theme") === "Adwaita" &&
      this._settings.get_boolean("recolor-folders")
    ) {
      this._interfaceSettings.set_string("icon-theme", "Adwaita-Dynamic");
    }

    this._updateDesktopFile();
  }

  disable() {
    // Necessary to keep accent colors consistent when unlocking the session

    clearRecolorTimeout();

    this._settings?.disconnectObject(this);
    this._bgSettings?.disconnectObject(this);
    this._interfaceSettings?.disconnectObject(this);

    if (this._configId) {
      this._settings?.disconnect(this._configId);
      this._configId = null;
    }

    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = null;
    }

    this._generatedCssFile = ThemeUtils.removeShellStylesheet(
      this._generatedCssFile,
    );

    ThemeUtils.removeGtkStylesheet().catch((e) => {
      console.error(`Error removing the GTK stylesheet!: ${e.message}`);
    });

    FileUtils.removeDesktopFile();

    if (
      this._interfaceSettings.get_string("icon-theme") === "Adwaita-Dynamic"
    ) {
      this._interfaceSettings.set_string("icon-theme", "Adwaita");
    }

    this._settings = null;
    this._bgSettings = null;
    this._interfaceSettings = null;
    this._a11ySettings = null;
  }

  _updateDesktopFile() {
    const shouldCreate = this._settings.get_boolean("create-shortcut");
    if (shouldCreate) {
      FileUtils.createDesktopFile(this.path);
    } else {
      FileUtils.removeDesktopFile();
    }
  }

  async _autoApplyWallpaperColor() {
    if (this._settings.get_boolean("custom-color")) {
      await this._updateStyles(false, true);
      return;
    }

    let colorScheme = this._interfaceSettings.get_string("color-scheme");

    let uri =
      colorScheme === "prefer-dark"
        ? this._bgSettings.get_string("picture-uri-dark")
        : this._bgSettings.get_string("picture-uri");

    let color = await ColorUtils.calculateVibrantColor(uri);
    const colorChanged = color !== this._settings.get_string("accent-color");

    let updateIcons =
      colorChanged &&
      this._settings.get_boolean("recolor-folders") &&
      !this._settings.get_boolean("gnome-colors");

    if (colorChanged) {
      this._settings.set_string("accent-color", color);
    }

    await this._updateStyles(updateIcons, colorChanged);
  }

  async _updateIconPack() {
    const iconFolders = this._settings.get_boolean("recolor-folders");

    if (!iconFolders) {
      this._settings.set_boolean("recolor-apps", false);
      this._settings.set_boolean("morewaita", false);
    }

    const iconApps = this._settings.get_boolean("recolor-apps");
    const morewaita = this._settings.get_boolean("morewaita");
    const accent = this._settings.get_string("accent-color");
    const gnomeColors = this._settings.get_boolean("gnome-colors");

    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = null;
    }

    try {
      await ThemeUtils.updateIconPack(
        accent,
        iconFolders,
        iconApps,
        morewaita,
        gnomeColors,
      );
    } catch (error) {
      this._settings.set_string("last-error", error.message);
    }
  }

  async _updateStyles(updateIcons = false, colorChanged = false) {
    const gnomeColors = this._settings.get_boolean("gnome-colors");

    await this._updateShellStyles();
    await this._updateAppStyles();

    if (!gnomeColors && colorChanged) {
      this._reloadGtkStylesheet();
    }

    if (updateIcons) {
      await this._updateIconPack();
    }
  }

  async _updateShellStyles() {
    const color = this._settings.get_string("accent-color");
    const darker = this._settings.get_boolean("darker");
    const colorScheme = this._interfaceSettings.get_string("color-scheme");
    const tintShell = this._settings.get_boolean("tint-shell");
    const customCss = this._settings.get_boolean("custom-css");
    const gnomeColors = this._settings.get_boolean("gnome-colors");

    const lightStyle = sessionMode.colorScheme;
    const isLight = lightStyle === "prefer-light" && colorScheme === "default";

    await ThemeUtils.updateShellStylesheet(
      this.path,
      color,
      this._generatedCssFile,
      (file) => {
        this._generatedCssFile = file;
      },
      isLight,
      tintShell,
      darker,
      customCss,
      gnomeColors,
    );
  }

  async _updateAppStyles() {
    const color = this._settings.get_string("accent-color");
    const gtk3 = this._settings.get_boolean("tint-gtk3");
    const darker = this._settings.get_boolean("darker");
    const isDark =
      this._interfaceSettings.get_string("color-scheme") === "prefer-dark";
    const tintApps = this._settings.get_boolean("tint-apps");
    const gnomeColors = this._settings.get_boolean("gnome-colors");

    await ThemeUtils.updateGtkStylesheet(
      this.path,
      color,
      tintApps,
      isDark,
      gtk3,
      darker,
      gnomeColors,
    );
  }

  // This is necessary to force GTK4 applications to reload the stylesheet cache when the accent color changes.
  // This is done by toggling high-contrast mode on and off, which triggers a reload.
  // Gio.Subprocess is required in this case to prevent interface glitches when switching high contrast mode.
  _reloadGtkStylesheet() {
    const highContrast = this._a11ySettings.get_boolean("high-contrast");

    const cmd = `gsettings set org.gnome.desktop.a11y.interface high-contrast ${!highContrast} && gsettings set org.gnome.desktop.a11y.interface high-contrast ${highContrast}`;
    Gio.Subprocess.new(["bash", "-c", cmd], Gio.SubprocessFlags.NONE);
  }
}
