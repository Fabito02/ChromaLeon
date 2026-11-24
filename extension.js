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
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as ColorUtils from "./utils/colorUtils.js";
import * as FileUtils from "./utils/fileUtils.js";
import * as ThemeUtils from "./utils/themeUtils.js";
import { clearRecolorTimeout } from "./utils/recolorUtils.js";
import { throwIfCancelled, isCancelledError } from "./utils/cancellation.js";
import {
  sessionMode,
  messageTray,
} from "resource:///org/gnome/shell/ui/main.js";
import {
  Source,
  Notification,
} from "resource:///org/gnome/shell/ui/messageTray.js";
import { getColorCache, writeColorCacheFile } from "./utils/cacheUtils.js";

export default class ChromaLeon extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._bgSettings = null;
    this._interfaceSettings = null;
    this._configId = null;
    this._timeoutId = null;
    this._reloadGtkTimeout = null;
    this._restoreTimeout = null;
    this._dirtyTimeoutId = null;
    this._dirty = null;
    this._a11ySettings = null;
    this._cancellable = null;
    this._opChain = Promise.resolve();
    this._updatingColors = false;
    this._customStylesheet = null;
    this._lastErrorId = null;
    this._notifSource = null;
  }

  enable() {
    this._settings = this.getSettings();
    this._savedColorScheme = sessionMode.colorScheme;

    this._settings.set_string("last-error", "");

    this._notifSource = new Source({
      title: "ChromaLeon",
      iconName: "preferences-desktop-theme-symbolic",
    });
    this._notifSource.connectObject(
      "destroy",
      () => {
        this._notifSource = null;
      },
      this,
    );
    messageTray.add(this._notifSource);

    this._lastErrorId = this._settings.connect("changed::last-error", () => {
      const msg = this._settings.get_string("last-error");
      if (!msg) return;

      try {
        const notification = new Notification({
          source: this._notifSource,
          title: "ChromaLeon",
          body: msg,
          isTransient: false,
        });
        this._notifSource.addNotification(notification);
      } catch (e) {
        console.error("ChromaLeon: failed to send notification", e);
      }

      this._settings.set_string("last-error", "");
    });

    this._applyInitialStyles();

    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    this._bgSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.background",
    });

    this._a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.interface",
    });

    this._settings.connectObject(
      "changed::accent-color",
      () => {
        if (this._updatingColors) return;
        this._runOperation(async (cancellable) => {
          await this._updateStyles(
            this._settings.get_boolean("recolor-folders"),
            true,
            cancellable,
          );
        });
      },
      "changed::tint-color",
      () => {
        if (this._updatingColors) return;
        this._runOperation(async (cancellable) => {
          if (this._settings.get_boolean("tint-shell")) {
            await this._updateShellStyles(cancellable);
            throwIfCancelled(cancellable);
          }
          if (this._settings.get_boolean("tint-apps")) {
            await this._updateAppStyles(cancellable);
            throwIfCancelled(cancellable);
            await this._reloadGtkStylesheet(cancellable);
          }
        });
      },
      "changed::gnome-colors",
      () =>
        this._runOperation(async (cancellable) => {
          this._settings.set_boolean("custom-color", false);
          if (this._settings.get_boolean("gnome-colors")) {
            const nativeAccent =
              this._interfaceSettings.get_string("accent-color");
            if (nativeAccent) {
              this._setColorKey("accent-color", nativeAccent);
            }
          } else {
            await this._applyWallpaperColorsInternal(null, cancellable, {
              applyAccent: true,
              applyTint: false,
            });
          }
          throwIfCancelled(cancellable);
          await this._updateShellStyles(cancellable);
          throwIfCancelled(cancellable);
          await this._updateAppStyles(cancellable);
          throwIfCancelled(cancellable);
          await this._reloadGtkStylesheet(cancellable);
          throwIfCancelled(cancellable);
          await this._updateIconPack(cancellable);
        }),
      "changed::gnome-tint-colors",
      () =>
        this._runOperation(async (cancellable) => {
          this._settings.set_boolean("custom-tint-color", false);
          if (this._settings.get_boolean("gnome-tint-colors")) {
            const current = this._settings.get_string("tint-color");
            if (
              !current ||
              !Object.hasOwn(ThemeUtils.GNOME_ACCENTS_HEX, current.toLowerCase())
            ) {
              this._setColorKey("tint-color", "blue");
            }
          } else {
            await this._applyWallpaperColorsInternal(null, cancellable, {
              applyAccent: false,
              applyTint: true,
            });
          }
          throwIfCancelled(cancellable);
          if (this._settings.get_boolean("tint-shell")) {
            await this._updateShellStyles(cancellable);
            throwIfCancelled(cancellable);
          }
          if (this._settings.get_boolean("tint-apps")) {
            await this._updateAppStyles(cancellable);
            throwIfCancelled(cancellable);
            await this._reloadGtkStylesheet(cancellable);
          }
        }),
      "changed::tint-shell",
      () => this._markDirty("shell"),
      "changed::tint-panel",
      () => this._markDirty("shell"),
      "changed::custom-css",
      () => this._markDirty("shell"),
      "changed::tint-apps",
      () => this._markDirty("apps", "reload"),
      "changed::tint-gtk3",
      () => this._markDirty("apps"),
      "changed::tinting-strength",
      () => this._markDirty("shell", "apps", "reload"),
      "changed::darker",
      () => this._markDirty("shell", "apps", "reload"),
      "changed::prefer-light",
      () => this._markDirty("shell"),
      "changed::full-light",
      () => this._markDirty("shell"),
      "changed::recolor-folders",
      () =>
        this._runOperation(async (cancellable) => {
          await this._updateIconPack(cancellable);
        }),
      "changed::recolor-apps",
      () =>
        this._runOperation(async (cancellable) => {
          await this._updateIconPack(cancellable);
        }),
      "changed::morewaita",
      () =>
        this._runOperation(async (cancellable) => {
          await this._updateIconPack(cancellable);
        }),
      this,
    );

    this._interfaceSettings.connectObject(
      "changed::color-scheme",
      () =>
        this._runOperation(async (cancellable) => {
          this._loadShellStylesheet(cancellable);

          await this._autoApplyWallpaperColor(null, cancellable);
        }),
      "changed::accent-color",
      () => {
        if (this._settings.get_boolean("gnome-colors")) {
          this._settings.set_string(
            "accent-color",
            this._interfaceSettings.get_string("accent-color"),
          );
        }
      },
      this,
    );

    const handleWallpaperChange = async () => {
      let currentUri = this._getWallpaperUri();

      if (this._lastWallpaperUri === currentUri) return;
      this._lastWallpaperUri = currentUri;

      this._runOperation(async (cancellable) => {
        this._settings.set_boolean("custom-color", false);
        this._settings.set_boolean("custom-tint-color", false);
        await this._autoApplyWallpaperColor(null, cancellable);
      });
      return GLib.SOURCE_REMOVE;
    };

    this._bgSettings.connectObject(
      "changed::picture-uri-dark",
      handleWallpaperChange,
      "changed::picture-uri",
      handleWallpaperChange,
      this,
    );

    this._configId = this._settings.connect("changed::create-shortcut", () => {
      this._updateDesktopFile();
    });

    if (
      this._interfaceSettings.get_string("icon-theme") === "Adwaita" &&
      this._settings.get_boolean("recolor-folders")
    ) {
      this._interfaceSettings.set_string("icon-theme", "ChromaLeon");
    }

    this._updateDesktopFile();

    sessionMode.connectObject(
      "updated",
      () => {
        if (sessionMode.currentMode === "user") {
          this._loadShellStylesheet();
        }
      },
      this,
    );
  }

  disable() {
    // Necessary to keep accent colors consistent when unlocking the session

    clearRecolorTimeout();

    this._settings?.disconnectObject(this);
    this._bgSettings?.disconnectObject(this);
    this._interfaceSettings?.disconnectObject(this);
    sessionMode.disconnectObject(this);

    if (this._configId) {
      this._settings?.disconnect(this._configId);
      this._configId = null;
    }

    if (this._lastErrorId) {
      this._settings?.disconnect(this._lastErrorId);
      this._lastErrorId = null;
    }

    if (this._notifSource) {
      this._notifSource.destroy();
      this._notifSource = null;
    }

    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = null;
    }

    if (this._reloadGtkTimeout) {
      GLib.Source.remove(this._reloadGtkTimeout);
      this._reloadGtkTimeout = null;
    }

    if (this._restoreTimeout) {
      GLib.Source.remove(this._restoreTimeout);
      this._restoreTimeout = null;
    }

    if (this._dirtyTimeoutId) {
      GLib.Source.remove(this._dirtyTimeoutId);
      this._dirtyTimeoutId = null;
    }

    if (this._notifSource) {
      this._notifSource.disconnectObject(this);
      this._notifSource.destroy();
      this._notifSource = null;
    }

    this._dirty = null;

    ThemeUtils.resetShellThemeBase();
    ThemeUtils.removeGtkStylesheet();
    FileUtils.removeDesktopFile();

    if (this._customStylesheet) {
      ThemeUtils.removeShellStylesheet(this._customStylesheet);
      this._customStylesheet = null;
    }

    if (this._interfaceSettings?.get_string("icon-theme") === "ChromaLeon") {
      this._interfaceSettings.set_string("icon-theme", "Adwaita");
    }

    this._reloadGtkStylesheet();
    this._updateColorScheme(this._savedColorScheme);

    this._cancellable?.cancel();
    this._cancellable = null;
    this._opChain = Promise.resolve();
    this._settings = null;
    this._bgSettings = null;
    this._interfaceSettings = null;
    this._a11ySettings = null;
    this._savedColorScheme = null;
  }

  async _applyInitialStyles() {
    try {
      const gnomeColors = this._settings.get_boolean("gnome-colors");
      const tintApps = this._settings.get_boolean("tint-apps");
      await this._updateShellStyles(null);
      await this._updateAppStyles(null);
      if (!gnomeColors || tintApps) await this._reloadGtkStylesheet(null);
    } catch (e) {
      if (!isCancelledError(e)) {
        this._settings?.set_string("last-error", e.message ?? String(e));
      }
    }
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

  _markDirty(...flags) {
    if (!this._dirty) this._dirty = new Set();
    for (const f of flags) this._dirty.add(f);

    if (this._dirtyTimeoutId) {
      GLib.Source.remove(this._dirtyTimeoutId);
      this._dirtyTimeoutId = null;
    }

    this._dirtyTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      this._dirtyTimeoutId = null;

      const pending = this._dirty;
      this._dirty = null;

      if (!pending || pending.size === 0) return GLib.SOURCE_REMOVE;

      this._runOperation(async (cancellable) => {
        if (pending.has("shell")) {
          await this._updateShellStyles(cancellable);
          throwIfCancelled(cancellable);
        }
        if (pending.has("apps")) {
          await this._updateAppStyles(cancellable);
          throwIfCancelled(cancellable);
        }
        if (pending.has("reload")) {
          await this._reloadGtkStylesheet(cancellable);
          throwIfCancelled(cancellable);
        }
      });

      return GLib.SOURCE_REMOVE;
    });
  }

  _updateDesktopFile() {
    const shouldCreate = this._settings.get_boolean("create-shortcut");
    if (shouldCreate) {
      FileUtils.createDesktopFile(this.path);
    } else {
      FileUtils.removeDesktopFile();
    }
  }

  // Suppress changed::* signals during internal updates so _runOperation doesn't cancel itself.
  _setColorKey(key, value) {
    if (!value || this._settings.get_string(key) === value) return false;
    this._updatingColors = true;
    try {
      this._settings.set_string(key, value);
    } finally {
      this._updatingColors = false;
    }
    return true;
  }

  async _applyWallpaperColorsInternal(
    color = null,
    cancellable = null,
    { applyAccent = true, applyTint = true } = {},
  ) {
    throwIfCancelled(cancellable);

    const persistentChoices = this._settings.get_boolean("persistent-choices");
    const gnomeColors = this._settings.get_boolean("gnome-colors");
    const gnomeTintColors = this._settings.get_boolean("gnome-tint-colors");

    const shouldUpdateAccent =
      applyAccent &&
      !gnomeColors &&
      !(this._settings.get_boolean("custom-color") && !persistentChoices);
    const shouldUpdateTint =
      applyTint &&
      !gnomeTintColors &&
      !(this._settings.get_boolean("custom-tint-color") && !persistentChoices);

    if (!shouldUpdateAccent && !shouldUpdateTint) {
      return { accentChanged: false, tintChanged: false };
    }

    let cached = null;
    let vibrant = color;

    if (!vibrant) {
      const uri = this._getWallpaperUri();
      const colorCache = await getColorCache(cancellable);
      cached = colorCache[uri] ?? null;

      const needsVibrant =
        (shouldUpdateAccent &&
          !(persistentChoices && (cached?.persistentAccentColor || cached?.persistentColor))) ||
        (shouldUpdateTint && !(persistentChoices && cached?.persistentTintColor));

      if (needsVibrant) {
        if (cached?.vibrant) {
          vibrant = cached.vibrant;
        } else {
          vibrant = await ColorUtils.calculateVibrantColor(uri);
          if (vibrant) {
            await writeColorCacheFile(uri, { vibrant }, cancellable);
          }
        }
      }
    }

    throwIfCancelled(cancellable);

    let accentChanged = false;
    if (shouldUpdateAccent) {
      const nextAccent =
        color ??
        (persistentChoices
          ? (cached?.persistentAccentColor ?? cached?.persistentColor)
          : null) ??
        vibrant;
      accentChanged = this._setColorKey("accent-color", nextAccent);
    }

    let tintChanged = false;
    if (shouldUpdateTint) {
      const nextTint =
        color ??
        (persistentChoices ? cached?.persistentTintColor : null) ??
        vibrant;
      tintChanged = this._setColorKey("tint-color", nextTint);
    }

    return { accentChanged, tintChanged };
  }

  async _autoApplyWallpaperColor(color = null, cancellable = null) {
    throwIfCancelled(cancellable);

    const { accentChanged, tintChanged } =
      await this._applyWallpaperColorsInternal(color, cancellable);

    throwIfCancelled(cancellable);

    const tintShell = this._settings.get_boolean("tint-shell");
    const tintApps = this._settings.get_boolean("tint-apps");

    if (accentChanged) {
      await this._updateStyles(
        this._settings.get_boolean("recolor-folders"),
        true,
        cancellable,
      );
    } else if (tintChanged) {
      if (tintShell) {
        await this._updateShellStyles(cancellable);
        throwIfCancelled(cancellable);
      }
      if (tintApps) {
        await this._updateAppStyles(cancellable);
        throwIfCancelled(cancellable);
        await this._reloadGtkStylesheet(cancellable);
      }
    } else {
      await this._updateAppStyles(cancellable);
    }
  }

  async _updateIconPack(cancellable) {
    throwIfCancelled(cancellable);

    const iconFolders = this._settings.get_boolean("recolor-folders");
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
        cancellable,
      );
    } catch (error) {
      if (isCancelledError(error)) throw error;
      this._settings.set_string("last-error", error.message);
    }
  }

  async _updateStyles(
    updateIcons = false,
    styleChanged = false,
    cancellable = null,
  ) {
    throwIfCancelled(cancellable);

    const gnomeColors = this._settings.get_boolean("gnome-colors");

    await this._updateShellStyles(cancellable);
    throwIfCancelled(cancellable);
    await this._updateAppStyles(cancellable);

    if (!gnomeColors && styleChanged) {
      throwIfCancelled(cancellable);
      await this._reloadGtkStylesheet(cancellable);
    }

    if (updateIcons) {
      throwIfCancelled(cancellable);
      await this._updateIconPack(cancellable);
    }
  }

  async _updateShellStyles(cancellable) {
    throwIfCancelled(cancellable);

    const accentColor = this._settings.get_string("accent-color");
    const tintColor = this._settings.get_string("tint-color");
    const darker = this._settings.get_boolean("darker");
    const tintShell = this._settings.get_boolean("tint-shell");
    const gnomeColors = this._settings.get_boolean("gnome-colors");
    const tintPanel = this._settings.get_boolean("tint-panel");
    const tintStrength = this._settings.get_int("tinting-strength");
    const fullLight = this._settings.get_boolean("full-light");
    const preferLight = this._settings.get_boolean("prefer-light");

    this._updateColorScheme(preferLight);

    await ThemeUtils.updateShellStylesheet(
      this.path,
      accentColor,
      tintColor,
      tintShell,
      darker,
      gnomeColors,
      tintPanel,
      tintStrength,
      fullLight,
      cancellable,
    );

    this._loadShellStylesheet(cancellable);
  }

  _loadShellStylesheet(cancellable = null) {
    throwIfCancelled(cancellable);

    const cacheDir = GLib.get_user_cache_dir();

    const lightFile = Gio.File.new_for_path(
      `${cacheDir}/chromaleon/chromaleon-shell.css`,
    );
    const darkFile = Gio.File.new_for_path(
      `${cacheDir}/chromaleon/chromaleon-shell-dark.css`,
    );
    const customStylesheet = Gio.File.new_for_path(
      `${cacheDir}/chromaleon/chromaleon-shell-custom.css`,
    );

    const isLight = this._shouldUseLightShell();
    const activeFilePath = isLight ? lightFile.get_path() : darkFile.get_path();

    if (
      activeFilePath &&
      Gio.File.new_for_path(activeFilePath).query_exists(null)
    ) {
      ThemeUtils.applyShellThemeBase(activeFilePath);
    }

    const themeContext = St.ThemeContext.get_for_stage(global.stage);
    const theme = themeContext?.get_theme();
    if (!theme) return;

    if (this._customStylesheet) {
      theme.unload_stylesheet(this._customStylesheet);
      this._customStylesheet = null;
    }

    const customCSS = this._settings.get_boolean("custom-css");
    if (!customCSS || !customStylesheet.query_exists(null)) return;

    try {
      theme.load_stylesheet(customStylesheet);
      this._customStylesheet = customStylesheet;
    } catch (e) {
      this._settings?.set_string(
        "last-error",
        `Invalid custom stylesheet: ${e.message}`,
      );
    }
  }

  async _updateAppStyles(cancellable) {
    throwIfCancelled(cancellable);

    const accentColor = this._settings.get_string("accent-color");
    const tintColor = this._settings.get_string("tint-color");
    const gtk3 = this._settings.get_boolean("tint-gtk3");
    const darker = this._settings.get_boolean("darker");
    const isDark =
      this._interfaceSettings.get_string("color-scheme") === "prefer-dark";
    const tintApps = this._settings.get_boolean("tint-apps");
    const gnomeColors = this._settings.get_boolean("gnome-colors");
    const tintStrength = this._settings.get_int("tinting-strength");

    await ThemeUtils.updateGtkStylesheet(
      this.path,
      accentColor,
      tintColor,
      tintApps,
      isDark,
      gtk3,
      darker,
      gnomeColors,
      tintStrength,
      cancellable,
    );
  }

  _shouldUseLightShell() {
    const preferLight = this._settings.get_boolean("prefer-light");
    const systemColorScheme =
      this._interfaceSettings.get_string("color-scheme");

    if (preferLight) {
      return systemColorScheme !== "prefer-dark";
    }
    return false;
  }

  _updateColorScheme(isLight) {
    sessionMode.colorScheme = isLight ? "prefer-light" : this._savedColorScheme;
    St.Settings.get().notify("color-scheme");
  }

  _clearReloadTimeout(key) {
    if (this[key]) {
      GLib.Source.remove(this[key]);
      this[key] = null;
    }
  }

  _getWallpaperUri() {
    const isDark =
      this._interfaceSettings.get_string("color-scheme") === "prefer-dark";
    const key = isDark ? "picture-uri-dark" : "picture-uri";
    return this._bgSettings.get_string(key);
  }

  async _reloadGtkStylesheet(cancellable = null) {
    throwIfCancelled(cancellable);

    const hotReload = this._settings.get_int("hot-reload");
    if (!hotReload) return;

    this._clearReloadTimeout("_reloadGtkTimeout");

    const now = GLib.get_monotonic_time();
    if (!this._lastReloadTime || now - this._lastReloadTime > 400_000) {
      this._lastReloadTime = now;
      await this._applyGtkReload(hotReload, cancellable);
      return;
    }

    this._reloadGtkTimeout = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      300,
      () => {
        this._reloadGtkTimeout = null;
        this._lastReloadTime = GLib.get_monotonic_time();
        this._applyGtkReload(hotReload, cancellable);
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  async _applyGtkReload(hotReload, cancellable) {
    if (cancellable?.is_cancelled()) return;

    const hc = this._a11ySettings.get_boolean("high-contrast");

    if (hotReload === 1) {
      this._a11ySettings.set_boolean("high-contrast", !hc);
      this._a11ySettings.set_boolean("high-contrast", hc);
    } else if (hotReload === 2) {
      await this._runSmoothReload(hc, cancellable);
    }
  }

  // This is necessary to force GTK4 applications to reload the stylesheet cache when the accent color changes.
  // This is done by toggling high-contrast mode on and off, which triggers a reload.
  // Gio.Subprocess is required in this case to prevent interface glitches when switching high contrast mode.

  async _runSmoothReload(hc, cancellable) {
    const schema = "org.gnome.desktop.a11y.interface";
    const cmd = `gsettings set ${schema} high-contrast ${!hc} && gsettings get ${schema} high-contrast > /dev/null && gsettings set ${schema} high-contrast ${hc}`;

    try {
      const proc = Gio.Subprocess.new(
        ["bash", "-c", cmd],
        Gio.SubprocessFlags.NONE,
      );

      await new Promise((resolve, reject) => {
        proc.wait_async(cancellable || null, (p, res) => {
          try {
            p.wait_finish(res);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      this._clearReloadTimeout("_restoreTimeout");
      this._restoreTimeout = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        3000,
        () => {
          this._restoreTimeout = null;
          if (this._a11ySettings?.get_boolean("high-contrast") !== hc) {
            this._a11ySettings?.set_boolean("high-contrast", hc);
          }
          return GLib.SOURCE_REMOVE;
        },
      );
    } catch (e) {
      if (!isCancelledError(e)) {
        this._settings?.set_string(
          "last-error",
          `GTK reload error: ${e.message}`,
        );
      }
    }
  }
}
