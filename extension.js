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
  }

  enable() {
    this._settings = this.getSettings();

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    this._updateShellStyles();

    this._settings.connectObject(
      "changed::accent-color",
      () => this._updateStyles(true),
      "changed::tint-shell",
      () => this._updateStyles(),
      "changed::tint-apps",
      () => this._updateStyles(),
      this,
    );

    this._settings.connectObject(
      "changed::recolor-folders",
      () => this._updateIconPack(),
      "changed::recolor-apps",
      () => this._updateIconPack(),
      "changed::morewaita",
      () => this._updateIconPack(),
      this,
    );

    this._interfaceSettings.connectObject(
      "changed::color-scheme",
      () => this._autoApplyWallpaperColor(),
      this,
    );

    this._bgSettings.connectObject(
      "changed::picture-uri-dark",
      () => {
        this._settings.set_boolean("custom-color", false);
        this._autoApplyWallpaperColor();
      },
      "changed::picture-uri",
      () => {
        this._settings.set_boolean("custom-color", false);
        this._autoApplyWallpaperColor();
      },
      this,
    );

    this._configId = this._settings.connect("changed::create-shortcut", () => {
      this._updateDesktopFile();
    });

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
    ThemeUtils.removeGtkStylesheet();

    FileUtils.removeDesktopFile();

    this._settings = null;
    this._bgSettings = null;
    this._interfaceSettings = null;
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
      this._updateStyles();
      return;
    }

    let colorScheme = this._interfaceSettings.get_string("color-scheme");

    let uri =
      colorScheme === "prefer-dark"
        ? this._bgSettings.get_string("picture-uri-dark")
        : this._bgSettings.get_string("picture-uri");

    let color = await ColorUtils.calculateVibrantColor(uri);
    let updateIcons = true;

    color === this._settings.get_string("accent-color")
      ? (updateIcons = false)
      : (updateIcons = true);

    if (updateIcons) {
      this._settings.set_string("accent-color", color);
    }

    this._updateStyles(updateIcons);
  }

  _updateIconPack() {
    let iconFolders = this._settings.get_boolean("recolor-folders");

    if (!iconFolders) {
      this._settings.set_boolean("recolor-apps", false);
      this._settings.set_boolean("morewaita", false);
    }

    let iconApps = this._settings.get_boolean("recolor-apps");
    let morewaita = this._settings.get_boolean("morewaita");

    let accent = this._settings.get_string("accent-color");

    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = null;
    }

    ThemeUtils.updateIconPack(accent, iconFolders, iconApps, morewaita, this);
  }

  _updateStyles(updateIcons) {
    let color = this._settings.get_string("accent-color");
    let colorScheme = this._interfaceSettings.get_string("color-scheme");

    const lightStyle = sessionMode.colorScheme;

    let isDark = colorScheme === "prefer-dark";
    let isLight = lightStyle === "prefer-light" && colorScheme === "default";

    const tintShell = this._settings.get_boolean("tint-shell");
    const tintApps = this._settings.get_boolean("tint-apps");

    ThemeUtils.updateShellStylesheet(
      this.path,
      color,
      this._generatedCssFile,
      (file) => {
        this._generatedCssFile = file;
      },
      isLight,
      tintShell,
    );

    ThemeUtils.updateGtkStylesheet(this.path, color, tintApps, isDark);

    updateIcons && this._updateIconPack();
  }

  _updateShellStyles() {
    let color = this._settings.get_string("accent-color");
    let colorScheme = this._interfaceSettings.get_string("color-scheme");

    const lightStyle = sessionMode.colorScheme;

    let isLight = lightStyle === "prefer-light" && colorScheme === "default";

    const tintShell = this._settings.get_boolean("tint-shell");

    ThemeUtils.updateShellStylesheet(
      this.path,
      color,
      this._generatedCssFile,
      (file) => {
        this._generatedCssFile = file;
      },
      isLight,
      tintShell,
    );
  }
}
