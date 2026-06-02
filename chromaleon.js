import GLib from "gi://GLib";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import { buildUI } from "./ui.js";

GLib.set_application_name("ChromaLeon");

const app = new Adw.Application({
  application_id: "com.github.fabito02.chromaleon",
});

app.connect("activate", (app) => {
  const window = new Adw.PreferencesWindow({ application: app });
  window.set_default_size(600, 635);
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