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
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { sessionMode } from "resource:///org/gnome/shell/ui/main.js";
import * as ColorUtils from "./utils/colorUtils.js";
import * as FileUtils from "./utils/fileUtils.js";
import * as ThemeUtils from "./utils/themeUtils.js";

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

    this._settings.connectObject(
      "changed::accent-color",
      () => this._updateStyles(),
      "changed::tint-shell",
      () => this._updateStyles(),
      "changed::tint-apps",
      () => this._updateStyles(),
      this,
    );

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._interfaceSettings.connectObject(
      "changed::color-scheme",
      () => this._autoApplyWallpaperColor(),
      this,
    );

    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

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
    this._settings?.disconnectObject(this);
    this._bgSettings?.disconnectObject(this);
    this._interfaceSettings?.disconnectObject(this);

    this._generatedCssFile = ThemeUtils.removeShellStylesheet(
      this._generatedCssFile,
    );
    ThemeUtils.removeGtkStylesheet();

    if (this._configId) {
      this._settings.disconnect(this._configId);
      this._configId = null;
    }

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
    if (color) {
      this._settings.set_string("accent-color", color);
    }

    this._updateStyles();
  }

  _updateStyles() {
    let color = this._settings.get_string("accent-color");

    let interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });
    let colorScheme = interfaceSettings.get_string("color-scheme");

    const lightStyle = sessionMode.colorScheme;

    let isDark = colorScheme === "prefer-dark";
    let isLight = false;

    lightStyle === "prefer-light" && colorScheme === "default"
      ? (isLight = true)
      : null;

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
  }
}
