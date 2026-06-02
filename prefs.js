import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import Adw from "gi://Adw";
import { buildUI } from "./chromaleon.js";

export default class CustomAccentPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage();
    window.add(page);
    
    buildUI(window, page, settings, this.dir.get_path());
  }
}
