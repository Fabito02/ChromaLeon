/*
 * preloadPage.js
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
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import Pango from "gi://Pango";
import { _ } from "../chromaleon.js";

export class PreloadPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor(settings, window, banner) {
    super({
      title: _("Compatibility"),
      icon_name: "puzzle-piece-symbolic",
    });

    this.add_css_class("symbolic");
    this._settings = settings;
    this._window = window;
    this._banner = banner;

    this._targetsFile = Gio.File.new_for_path(
      `${GLib.get_user_config_dir()}/ChromaLeon/targets`,
    );
    this._preloadPath = Gio.File.new_for_path(
      `${GLib.get_home_dir()}/.local/lib/libchromaleon.so`,
    );

    if (this._preloadPath.query_exists(null)) {
      this._buildInstalledUI();
    } else {
      this._buildSupportGroup();
    }
  }

  _readTargets() {
    if (!this._targetsFile.query_exists(null)) return [];

    const [, bytes] = this._targetsFile.load_contents(null);
    const text = new TextDecoder("utf-8").decode(bytes);

    return text.split(/[\s,]+/).filter((s) => s.length > 0);
  }

  _saveTargets(apps) {
    const parent = this._targetsFile.get_parent();
    if (parent && !parent.query_exists(null)) {
      try {
        parent.make_directory_with_parents(null);
      } catch (_) {}
    }

    const bytes = new GLib.Bytes(
      new TextEncoder().encode(apps.join("\n") + "\n"),
    );
    this._targetsFile.replace_contents(
      bytes.get_data(),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  }

  _checkUpdate(callback) {
    const localFile = Gio.File.new_for_path(
      `${GLib.get_user_config_dir()}/ChromaLeon/preload_version`,
    );

    let local;
    if (localFile.query_exists(null)) {
      const [, bytes] = localFile.load_contents(null);
      local = new TextDecoder().decode(bytes).trim();
    } else {
      local = null;
    }

    const remoteFile = Gio.File.new_for_uri(
      "https://raw.githubusercontent.com/Fabito02/chromaleon-preload/main/VERSION",
    );

    const cancellable = new Gio.Cancellable();
    const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 8, () => {
      cancellable.cancel();
      return GLib.SOURCE_REMOVE;
    });

    remoteFile.load_contents_async(cancellable, (src, res) => {
      if (timeoutId) {
        GLib.source_remove(timeoutId);
      }

      let remote;
      try {
        const [, bytes] = src.load_contents_finish(res);
        remote = new TextDecoder().decode(bytes).trim();
      } catch (_) {
        callback({ state: "offline", local });
        return;
      }

      if (!remote) {
        callback({ state: "offline", local });
        return;
      }
      callback({
        state: local === remote ? "current" : "outdated",
        local,
        remote,
      });
    });
  }

  _buildInstalledUI() {
    let activeApps = this._readTargets();

    const versionGroup = new Adw.PreferencesGroup({
      title: _("Preload version"),
    });
    this.add(versionGroup);

    const versionRow = new Adw.ActionRow({
      title: _("Version status"),
      subtitle: _("Checking..."),
      activatable: true,
      selectable: true,
    });

    versionGroup.add(versionRow);
    versionRow.add_css_class("action-row-button");

    versionRow.connect("activated", () => {
      Gtk.show_uri(
        null,
        "https://github.com/Fabito02/chromaleon-preload#installation",
        null,
      );
    });

    const statusIcon = new Gtk.Image({
      icon_name: "content-loading-symbolic",
    });

    const setupGuideExternalIcon = new Gtk.Image({
      icon_name: "external-link-symbolic",
    });

    versionRow.add_prefix(statusIcon);
    versionRow.add_suffix(setupGuideExternalIcon);

    this._checkUpdate((result) => {
      for (const c of ["success", "warning", "regular", "dim-label"])
        statusIcon.remove_css_class(c);

      if (result.state === "offline") {
        versionRow.set_title(_("Offline"));
        versionRow.set_subtitle(
          result.local
            ? _("Installed: %s (could not check).").replace("%s", result.local)
            : _("Could not check for updates."),
        );
        statusIcon.set_from_icon_name("network-offline-symbolic");
        statusIcon.add_css_class("dim-label");
        this._banner.revealed = false;
        return;
      }

      if (result.state === "current") {
        versionRow.set_title(_("Current"));
        versionRow.set_subtitle(
          _("Installed: %s — up to date.").replace("%s", result.local),
        );
        statusIcon.set_from_icon_name("object-select-symbolic");
        statusIcon.add_css_class("success");
        this._banner.revealed = false;
        return;
      }

      if (result.state === "outdated") {
        versionRow.set_title(_("Outdated"));
        versionRow.set_subtitle(
          _("Installed: %s — %s available.")
            .replace("%s", result.local ?? _("Unknown"))
            .replace("%s", result.remote),
        );
        statusIcon.set_from_icon_name("software-update-available-symbolic");
        statusIcon.add_css_class("warning");
        this._banner.revealed = true;
        return;
      }
    });

    const optionsGroup = new Adw.PreferencesGroup({
      title: _("Target apps"),
      description: _(
        "Enter the process name (e.g., firefox, thunderbird, zen-browser) to apply the ChromaLeon accent color.",
      ),
    });
    this.add(optionsGroup);

    const entryRow = new Adw.EntryRow({
      title: _("Add Application"),
      show_apply_button: true,
    });

    const tagsRow = new Adw.PreferencesRow({
      activatable: false,
      selectable: false,
    });

    const wrapBox = new Adw.WrapBox({
      child_spacing: 8,
      line_spacing: 8,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 12,
      margin_end: 12,
      align: 0,
    });

    tagsRow.set_child(wrapBox);

    const createTagChip = (appName) => {
      const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        valign: Gtk.Align.CENTER,
      });
      box.add_css_class("tag");

      const label = new Gtk.Label({
        label: appName,
        xalign: 0,
        hexpand: true,
        ellipsize: Pango.EllipsizeMode.END,
      });

      const removeBtn = new Gtk.Button({
        icon_name: "window-close-symbolic",
        has_frame: false,
        valign: Gtk.Align.CENTER,
        tooltip_text: `${_("Remove")} ${appName}`,
      });
      removeBtn.add_css_class("flat");
      removeBtn.add_css_class("circular");

      removeBtn.connect("clicked", () => {
        wrapBox.remove(box);
        const index = activeApps.indexOf(appName);
        if (index > -1) {
          activeApps.splice(index, 1);
          this._saveTargets(activeApps);
        }
      });

      box.append(label);
      box.append(removeBtn);

      wrapBox.append(box);
      return box;
    };

    const handleAddApp = () => {
      const rawText = entryRow.get_text().trim().toLowerCase();
      if (rawText && !rawText.includes(" ") && !activeApps.includes(rawText)) {
        activeApps.push(rawText);
        this._saveTargets(activeApps);
        createTagChip(rawText);
        entryRow.set_text("");
      }
    };

    entryRow.connect("apply", handleAddApp);
    entryRow.connect("entry-activated", handleAddApp);

    activeApps.forEach(createTagChip);

    optionsGroup.add(entryRow);
    optionsGroup.add(tagsRow);
  }

  _buildSupportGroup() {
    const supportGroup = new Adw.PreferencesGroup();
    this.add(supportGroup);

    const supportRow = new Adw.PreferencesRow({
      activatable: false,
      focusable: false,
    });
    supportGroup.add(supportRow);
    supportRow.add_css_class("support-row");
    supportRow.add_css_class("dark");

    const contentBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 28,
      margin_top: 24,
      margin_bottom: 24,
      margin_start: 24,
      margin_end: 24,
      hexpand: true,
      halign: Gtk.Align.CENTER,
    });

    const title = _("This option requires additional configuration.");
    const contentSupport = _(
      "To synchronize accent colors with applications that do not support ChromaLeon colors, the preload library must be compiled and installed (this is not necessary if using GNOME colors).",
    );

    const label = new Gtk.Label({
      use_markup: true,
      wrap: true,
      wrap_mode: Pango.WrapMode.WORD_CHAR,
      justify: Gtk.Justification.CENTER,
      xalign: 0.5,
      label: `<span size='x-large' weight='heavy'>${title}</span>\n\n${contentSupport}`,
    });
    contentBox.append(label);

    const buttonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      halign: Gtk.Align.CENTER,
    });

    const generateButton = (iconName, labelText) => {
      const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
      });

      const icon = Gtk.Image.new_from_icon_name(iconName);
      icon.add_css_class("symbolic");

      const btnLabel = new Gtk.Label({ label: labelText });
      box.append(btnLabel);
      box.append(icon);

      return new Gtk.Button({
        valign: Gtk.Align.CENTER,
        child: box,
      });
    };

    const instructionsButton = generateButton(
      "external-link-symbolic",
      _("Setup Guide"),
    );
    instructionsButton.add_css_class("pill");

    instructionsButton.connect("clicked", () => {
      Gtk.show_uri(
        null,
        "https://github.com/Fabito02/chromaleon-preload#installation",
        null,
      );
    });

    buttonBox.append(instructionsButton);
    contentBox.append(buttonBox);

    supportRow.set_child(contentBox);
  }
}
