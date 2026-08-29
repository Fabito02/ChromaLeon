import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import * as Gettext from "gettext";
import { WallpaperPage } from "./ui/wallpaperPage.js";
import { PreferencesPage } from "./ui/preferencesPage.js";

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

  const wallpaperPage = new WallpaperPage(
    settings,
    bgSettings,
    interfaceSettings,
  );
  const preferencesPage = new PreferencesPage(settings, window);

  window.add(wallpaperPage);
  window.add(preferencesPage);
}

if (GLib.getenv("CHROMALEON_LAUNCH") === "1") {
  GLib.set_application_name("ChromaLeon");

  const app = new Adw.Application({
    application_id: "com.github.fabito02.chromaleon",
  });

  app.connect("activate", (app) => {
    const window = new Adw.PreferencesWindow({ application: app });
    window.set_default_size(520, 680);
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
