import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import { buildUI } from "./ui.js";

const app = new Adw.Application({
  application_id: "com.github.fabito02.chromaleon",
});

function showDonateModal(parentWindow) {
  const dialog = new Adw.MessageDialog({
    transient_for: parentWindow,
    heading: "Why support ChromaLeon?",
    body: "Developing free software requires time, energy, and dedication. Your donation directly supports the project and helps keep it alive!",
    close_response: "cancel",
  });
  dialog.add_response("cancel", "Cancel");
  dialog.add_response("donate", "Support");
  dialog.set_response_appearance("donate", Adw.ResponseAppearance.SUGGESTED);
  dialog.connect("response", (dialog, response) => {
    if (response === "donate") {
      Gio.AppInfo.launch_default_for_uri(
        "https://buymeacoffee.com/fabito02",
        null,
      );
    }
    dialog.destroy();
  });
  dialog.present();
}

app.connect("activate", (app) => {
  const window = new Adw.PreferencesWindow({ application: app });
  window.set_default_size(600, 635);
  window.set_title("ChromaLeon");

  const donateIcon = Gtk.Image.new_from_file("./assets/heart-filled-symbolic.svg");
  const donateButton = new Gtk.Button({
      valign: Gtk.Align.CENTER,
  });
  
  donateButton.set_child(donateIcon);
  donateButton.add_css_class("flat");
  donateButton.set_tooltip_text("Support the project");
  donateButton.add_css_class("heart-button");
  
  const cssProvider = new Gtk.CssProvider();
  cssProvider.load_from_data(`
      .heart-button:hover {
          color: #FF5C5C;
      }
  `, -1);
  
  donateButton.get_style_context().add_provider(
      cssProvider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
  );
  donateButton.connect("clicked", () => showDonateModal(window));

  const page = new Adw.PreferencesPage();
  window.add(page); 

  const settings = new Gio.Settings({
    schema_id: "org.gnome.shell.extensions.chromaleon",
    path: "/org/gnome/shell/extensions/chromaleon/",
  });

  buildUI(window, page, settings);

  const injectIntoHeader = (parent) => {
    for (let child = parent.get_first_child(); child !== null; child = child.get_next_sibling()) {
      if (child instanceof Adw.HeaderBar || child instanceof Gtk.HeaderBar) {
        child.pack_end(donateButton);
        return true;
      }
      if (injectIntoHeader(child)) return true;
    }
    return false;
  };
  
  injectIntoHeader(window);

  window.present();
});

app.run(ARGV);