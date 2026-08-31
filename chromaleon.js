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
import * as Gettext from "gettext";
import { WallpaperPage } from "./ui/wallpaperPage.js";
import { PreferencesPage } from "./ui/preferencesPage.js";
import { PreloadPage } from "./ui/preloadPage.js";

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
Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  const localeDir = GLib.get_current_dir() + "/locale";
  Gettext.bindtextdomain("chromaleon", localeDir);
}

const currentModulePath = import.meta.url;
const extensionDirPath = currentModulePath.startsWith("file://")
  ? Gio.File.new_for_uri(currentModulePath).get_parent().get_path()
  : GLib.get_current_dir();

export function buildUI(window, settings) {
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

  const bgSettings = new Gio.Settings({
    schema_id: "org.gnome.desktop.background",
  });
  const interfaceSettings = new Gio.Settings({
    schema_id: "org.gnome.desktop.interface",
  });

  const toolbarView = new Adw.ToolbarView();

  const headerBar = new Adw.HeaderBar({
    centering_policy: Adw.CenteringPolicy.STRICT,
  });

  const titleWidget = new Adw.ViewSwitcherTitle({
    title: "ChromaLeon",
  });
  headerBar.set_title_widget(titleWidget);

  const viewStack = new Adw.ViewStack({
    vexpand: true,
    hexpand: true,
  });
  titleWidget.set_stack(viewStack);

  const switcherBar = new Adw.ViewSwitcherBar({
    stack: viewStack,
    reveal: false,
  });

  toolbarView.add_top_bar(headerBar);
  toolbarView.set_content(viewStack);
  toolbarView.add_bottom_bar(switcherBar);

  window.set_content(toolbarView);

  const breakpoint = new Adw.Breakpoint({
    condition: Adw.BreakpointCondition.parse("max-width: 600px"),
  });

  breakpoint.add_setter(titleWidget, "view-switcher-enabled", false);
  breakpoint.add_setter(switcherBar, "reveal", true);
  window.add_breakpoint(breakpoint);

  const wallpaperPage = new WallpaperPage(
    settings,
    bgSettings,
    interfaceSettings,
  );
  const preferencesPage = new PreferencesPage(settings, window);
  const preloadPage = new PreloadPage(settings, window);

  const addPage = (page) => {
    const stackPage = viewStack.add(page);
    if (page.name) stackPage.name = page.name;
    if (page.title) stackPage.title = page.title;
    if (page.icon_name) stackPage.icon_name = page.icon_name;
  };

  addPage(wallpaperPage);
  addPage(preloadPage);
  addPage(preferencesPage);
}

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  GLib.set_application_name("ChromaLeon");

  const app = new Adw.Application({
    application_id: "com.github.fabito02.chromaleon",
  });

  app.connect("activate", (app) => {
    const window = new Adw.ApplicationWindow({ application: app });
    window.set_default_size(490, 670);
    window.set_title("ChromaLeon");

    const settings = new Gio.Settings({
      schema_id: "org.gnome.shell.extensions.chromaleon",
      path: "/org/gnome/shell/extensions/chromaleon/",
    });

    buildUI(window, settings);
    window.present();
  });

  app.run(ARGV);
}
