/*
 * colorSelector.js
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
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import { _ } from "../chromaleon.js";
import { toHex } from "../utils/colorUtils.js";
import { throwIfCancelled } from "../utils/cancellation.js";
import { writeColorCacheFile } from "../utils/cacheUtils.js";

const GNOME_COLORS = [
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

export class ColorSelector extends Adw.PreferencesGroup {
  static {
    GObject.registerClass(this);
  }

  constructor({
    title,
    settings,
    interfaceSettings,
    colorKey,
    gnomeColorsKey,
    customFlagKey,
    cacheKey,
    legacyCacheKey = null,
    syncInterfaceAccent = false,
    runOperation,
  }) {
    super({ title });

    this._settings = settings;
    this._interfaceSettings = interfaceSettings;
    this._colorKey = colorKey;
    this._gnomeColorsKey = gnomeColorsKey;
    this._customFlagKey = customFlagKey;
    this._cacheKey = cacheKey;
    this._legacyCacheKey = legacyCacheKey;
    this._syncInterfaceAccent = syncInterfaceAccent;
    this._runOperation = runOperation;

    this._manualColor = false;
    this._displayedColors = [];
    this._swatchButtons = [];
    this._manualColorBtn = null;
    this._manualBtnProvider = new Gtk.CssProvider();

    this._buildUI();
    this._setupSignals();
  }

  _buildUI() {
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

    this._gnomeColorsRow = new Adw.SwitchRow({
      title: _("GNOME Colors"),
      subtitle: _("Use native GNOME colors instead of wallpaper colors."),
    });

    this._settings.bind(
      this._gnomeColorsKey,
      this._gnomeColorsRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this.add(this._colorsRow);
    this.add(this._moreColors);
    this.add(this._gnomeColorsRow);
  }

  _setupSignals() {
    this._colorChangedId = this._settings.connect(
      `changed::${this._colorKey}`,
      () => this._applyTheme(),
    );

    if (this._syncInterfaceAccent) {
      this._ifaceAccentId = this._interfaceSettings.connect(
        "changed::accent-color",
        () => this._applyTheme(),
      );
    }

    this.connect("destroy", () => this._onDestroy());
  }

  _onDestroy() {
    if (this._colorChangedId) {
      this._settings.disconnect(this._colorChangedId);
      this._colorChangedId = null;
    }
    if (this._ifaceAccentId) {
      this._interfaceSettings.disconnect(this._ifaceAccentId);
      this._ifaceAccentId = null;
    }
  }

  _isGnomeColors() {
    return this._settings.get_boolean(this._gnomeColorsKey);
  }

  _getActiveColor() {
    if (this._isGnomeColors() && this._syncInterfaceAccent) {
      return this._interfaceSettings.get_string("accent-color");
    }
    return this._settings.get_string(this._colorKey);
  }

  _setActiveColor(value) {
    if (this._isGnomeColors() && this._syncInterfaceAccent) {
      this._interfaceSettings.set_string("accent-color", value);
    } else {
      this._settings.set_string(this._colorKey, value);
    }
  }

  _applyTheme() {
    const isGnomeColor = this._isGnomeColors();
    const activeColor = this._getActiveColor();
    const activeLower = activeColor ? activeColor.toLowerCase() : "";

    if (isGnomeColor) {
      this._manualColor = false;
    } else if (this._displayedColors.length > 0) {
      this._manualColor = !this._displayedColors.some(
        (c) => c.toLowerCase() === activeLower,
      );
    }

    if (this._manualColorBtn) {
      if (this._manualColor && activeColor) {
        this._manualColorBtn.add_css_class("active");
        this._manualBtnProvider.load_from_string(
          `button.custom-color-btn.active,
           button.custom-color-btn.active:active,
           button.custom-color-btn.active:focus:active {
             background: ${activeColor};
             outline: 3px solid alpha(shade(${activeColor}, 1.3), 0.6);
             outline-offset: -3px;
           }`,
        );
      } else {
        this._manualColorBtn.remove_css_class("active");
        this._manualBtnProvider.load_from_string("");
      }
    }

    if (this._swatchButtons) {
      this._swatchButtons.forEach((item) => item.updateStyle());
    }
  }

  async render({ uri, wallpaperColors, cached, wallpaperChanged, cancellable }) {
    throwIfCancelled(cancellable);

    const isGnomeColor = this._isGnomeColors();
    const colors = isGnomeColor ? GNOME_COLORS : (wallpaperColors ?? []);
    this._displayedColors = colors;

    while (this._mainColorBox.get_first_child()) {
      this._mainColorBox.remove(this._mainColorBox.get_first_child());
    }
    while (this._moreColorBox.get_first_child()) {
      this._moreColorBox.remove(this._moreColorBox.get_first_child());
    }

    if (!colors || colors.length === 0) {
      this._colorsRow.set_subtitle(_("Unable to load colors."));
      this._moreColors.set_visible(false);
      this._manualColorBtn = null;
      this._swatchButtons = [];
      return;
    }

    this._colorsRow.set_subtitle("");
    this._swatchButtons = [];

    const maxMainColors = isGnomeColor ? colors.length : 8;
    this._moreColors.set_visible(colors.length > maxMainColors);

    let currentColor = this._getActiveColor();

    if (!isGnomeColor) {
      const isPersistentChoice =
        this._settings.get_boolean("persistent-choices");
      const cachedPersistent =
        cached?.[this._cacheKey] ??
        (this._legacyCacheKey ? cached?.[this._legacyCacheKey] : null);

      if (wallpaperChanged) {
        if (isPersistentChoice && cachedPersistent) {
          currentColor = cachedPersistent;
        } else {
          currentColor = colors[0];

          if (!isPersistentChoice && cachedPersistent && uri) {
            const clearPayload = { [this._cacheKey]: null };
            if (this._legacyCacheKey) clearPayload[this._legacyCacheKey] = null;
            await writeColorCacheFile(uri, clearPayload, cancellable);
            if (cached) {
              cached[this._cacheKey] = null;
              if (this._legacyCacheKey) cached[this._legacyCacheKey] = null;
            }
          }
        }

        if (this._settings.get_string(this._colorKey) !== currentColor) {
          this._settings.set_string(this._colorKey, currentColor);
        }
      } else {
        if (isPersistentChoice && uri && currentColor) {
          if (cached?.[this._cacheKey] !== currentColor) {
            await writeColorCacheFile(
              uri,
              { [this._cacheKey]: currentColor },
              cancellable,
            );
            if (cached) cached[this._cacheKey] = currentColor;
          }
        } else if (!isPersistentChoice && cached?.[this._cacheKey] && uri) {
          await writeColorCacheFile(
            uri,
            { [this._cacheKey]: null },
            cancellable,
          );
          if (cached) cached[this._cacheKey] = null;
        }
      }

      const currentLower = currentColor ? currentColor.toLowerCase() : "";
      this._manualColor = !colors.some((c) => c.toLowerCase() === currentLower);
    } else {
      this._manualColor = false;
      const currentLower = currentColor ? currentColor.toLowerCase() : "";
      if (!colors.some((c) => c.toLowerCase() === currentLower)) {
        currentColor = colors[0];
        this._setActiveColor(currentColor);
      }
    }

    throwIfCancelled(cancellable);

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
    this._manualColorBtn
      .get_style_context()
      .add_provider(
        this._manualBtnProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );

    const colorDialog = new Gtk.ColorDialog({
      with_alpha: false,
      title: _("Select Color"),
    });

    this._manualColorBtn.connect("clicked", () => {
      const currentHex = this._settings.get_string(this._colorKey);
      const initialRgba = new Gdk.RGBA();
      if (!initialRgba.parse(currentHex || "#3584e4")) {
        initialRgba.parse("#3584e4");
      }

      colorDialog.choose_rgba(
        this.get_root(),
        initialRgba,
        null,
        (dialog, res) => {
          let rgba;
          try {
            rgba = dialog.choose_rgba_finish(res);
          } catch (e) {
            return;
          }

          if (!rgba) return;

          const hex = `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
          this._runOperation(async (opCancellable) => {
            this._manualColor = true;
            this._settings.set_string(this._colorKey, hex);
            this._settings.set_boolean(this._customFlagKey, true);
            const isPersistentChoice =
              this._settings.get_boolean("persistent-choices");

            if (uri) {
              await writeColorCacheFile(
                uri,
                { [this._cacheKey]: isPersistentChoice ? hex : null },
                opCancellable,
              );
            }

            this._applyTheme();
          });
        },
      );
    });

    colors.forEach((hexColor, index) => {
      const btn = new Gtk.Button({
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
      });

      const cssProvider = new Gtk.CssProvider();

      const updateButtonStyle = () => {
        const color = isGnomeColor ? `var(--accent-${hexColor})` : hexColor;

        const activeHex = this._getActiveColor()?.toLowerCase();
        const itemHex = hexColor.toLowerCase();

        const isActive = isGnomeColor
          ? activeHex === itemHex
          : !this._manualColor && activeHex === itemHex;

        const cssString = isActive
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
      this._swatchButtons.push({ updateStyle: updateButtonStyle });

      btn
        .get_style_context()
        .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      btn.connect("clicked", () => {
        this._runOperation(async (opCancellable) => {
          this._manualColor = false;
          this._settings.set_boolean(this._customFlagKey, true);
          const isPersistentChoice =
            this._settings.get_boolean("persistent-choices");

          if (uri && !isGnomeColor) {
            await writeColorCacheFile(
              uri,
              { [this._cacheKey]: isPersistentChoice ? hexColor : null },
              opCancellable,
            );
          }

          this._setActiveColor(hexColor);
          this._applyTheme();
        });
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
}
