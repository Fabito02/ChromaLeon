/*
 * preferencesPage.js
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
 import * as Gettext from "gettext";
 
 const _ = (str) => {
   try {
     return Gettext.dgettext("chromaleon", str);
   } catch (e) {
     return str;
   }
 };
 
 export class PreferencesPage extends Adw.PreferencesPage {
   static {
     GObject.registerClass(this);
   }
 
   constructor(settings, window) {
     super({
       title: _("Preferences"),
       icon_name: "settings-symbolic",
     });
 
     this.add_css_class("symbolic");
     this._settings = settings;
     this._window = window;
 
     this._buildSupportGroup();
     this._buildColorsGroup();
     this._buildTintGroup();
     this._buildIconThemeGroup();
     this._buildCustomCssGroup();
     this._buildMiscGroup();
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
 
     const titleSupport = _("ChromaLeon only exists thanks to users like you!");
     const contentSupport = _(
       "If ChromaLeon has earned a place in your device's customization, consider helping the project move forward by making a small donation.",
     );
 
     const label = new Gtk.Label({
       use_markup: true,
       wrap: true,
       wrap_mode: Pango.WrapMode.WORD_CHAR,
       justify: Gtk.Justification.CENTER,
       xalign: 0.5,
       label: `<span size='x-large' weight='heavy'>${titleSupport}</span>\n\n${contentSupport}`,
     });
     contentBox.append(label);
 
     const buttonBox = new Gtk.Box({
       orientation: Gtk.Orientation.HORIZONTAL,
       spacing: 12,
       halign: Gtk.Align.CENTER,
     });
 
     const generateDonateButton = (iconName, labelText) => {
       const box = new Gtk.Box({
         orientation: Gtk.Orientation.HORIZONTAL,
         spacing: 6,
       });
 
       const icon = Gtk.Image.new_from_icon_name(iconName);
       icon.add_css_class("symbolic");
 
       const btnLabel = new Gtk.Label({ label: labelText });
       box.append(icon);
       box.append(btnLabel);
 
       return new Gtk.Button({
         valign: Gtk.Align.CENTER,
         child: box,
       });
     };
 
     const githubButton = generateDonateButton("github-symbolic", "Sponsors");
     const kofiButton = generateDonateButton("ko-fi-symbolic", "Ko-fi");
 
     githubButton.add_css_class("pill");
     kofiButton.add_css_class("pill");
 
     githubButton.connect("clicked", () => {
       Gtk.show_uri(null, "https://github.com/sponsors/Fabito02", null);
     });
 
     kofiButton.connect("clicked", () => {
       Gtk.show_uri(null, "https://ko-fi.com/fabito02", null);
     });
 
     buttonBox.append(githubButton);
     buttonBox.append(kofiButton);
     contentBox.append(buttonBox);
 
     supportRow.set_child(contentBox);
   }
 
   _buildColorsGroup() {
     const colorsGroup = new Adw.PreferencesGroup({
       title: _("Colors"),
     });
     this.add(colorsGroup);
 
     const gnomeColorsRow = new Adw.SwitchRow({
       title: _("GNOME Colors"),
       subtitle: _("Use native GNOME colors instead of wallpaper colors."),
     });
     colorsGroup.add(gnomeColorsRow);
 
     const preferLightRow = new Adw.ExpanderRow({
       title: _("Prefer Light Style"),
       subtitle: _("Use a light style for the Shell in the light theme."),
       show_enable_switch: true,
     });
     colorsGroup.add(preferLightRow);
 
     const fullLightRow = new Adw.SwitchRow({
       title: _("Fully Light"),
       subtitle: _(
         "Use a fully light style instead of the default style for the GNOME Shell light theme.",
       ),
     });
     preferLightRow.add_row(fullLightRow);
 
     this._settings.bind(
       "gnome-colors",
       gnomeColorsRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "prefer-light",
       preferLightRow,
       "enable-expansion",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "full-light",
       fullLightRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     preferLightRow.bind_property(
       "enable-expansion",
       preferLightRow,
       "expanded",
       GObject.BindingFlags.SYNC_CREATE,
     );
   }
 
   _buildTintGroup() {
     const tintGnomeGroup = new Adw.PreferencesGroup({
       title: _("Tint GNOME"),
       description: _("Based on Tint my GNOME"),
     });
     this.add(tintGnomeGroup);
 
     const TintShellRow = new Adw.ExpanderRow({
       title: _("Tint Shell"),
       subtitle: _("Tints the GNOME Shell with the color of your choice."),
       show_enable_switch: true,
     });
     tintGnomeGroup.add(TintShellRow);
 
     const TintPanel = new Adw.SwitchRow({
       title: _("Tint Dark Panel"),
       subtitle: _("Also tint the panel when in dark mode."),
     });
     TintShellRow.add_row(TintPanel);
 
     TintShellRow.bind_property(
       "enable-expansion",
       TintShellRow,
       "expanded",
       GObject.BindingFlags.SYNC_CREATE,
     );
 
     const TintAppsRow = new Adw.ExpanderRow({
       title: _("Tint Apps"),
       subtitle: _(
         "Tints the LibAdwaita applications with the color of your choice.",
       ),
       show_enable_switch: true,
     });
     tintGnomeGroup.add(TintAppsRow);
 
     let msg = _(
       "Also tint the GTK3 apps (the {0} extension and the {1} theme are required to avoid bugs).",
     );
     let extension_link =
       '<a href="https://extensions.gnome.org/extension/4998/legacy-gtk3-theme-scheme-auto-switcher/">"Legacy (GTK3) Theme Scheme Auto Switcher"</a>';
     let theme_link =
       '<a href="https://github.com/lassekongo83/adw-gtk3">"adw-gtk3"</a>';
 
     let subtitle_gtk3 = msg
       .replace("{0}", extension_link)
       .replace("{1}", theme_link);
 
     const TintGTK3AppsRow = new Adw.SwitchRow({
       title: _("Tint GTK3 Apps"),
       subtitle: subtitle_gtk3,
     });
     TintAppsRow.add_row(TintGTK3AppsRow);
 
     TintAppsRow.bind_property(
       "enable-expansion",
       TintAppsRow,
       "expanded",
       GObject.BindingFlags.SYNC_CREATE,
     );
 
     const tintingStrengthStringList = Gtk.StringList.new([
       _("Subtle"),
       _("Default"),
       _("Strong"),
       _("Stronger"),
     ]);
 
     const TintingStrengthRow = new Adw.ComboRow({
       title: _("Tinting Strength"),
       subtitle: _("Determines the strength of the tint effect."),
       model: tintingStrengthStringList,
     });
     tintGnomeGroup.add(TintingStrengthRow);
 
     const darkerRow = new Adw.SwitchRow({
       title: _("Darker Tint"),
       subtitle: _("Applies a darker tint."),
     });
     tintGnomeGroup.add(darkerRow);
 
     this._settings.bind(
       "tint-shell",
       TintShellRow,
       "enable-expansion",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "tint-panel",
       TintPanel,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "tint-apps",
       TintAppsRow,
       "enable-expansion",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "tint-gtk3",
       TintGTK3AppsRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "tinting-strength",
       TintingStrengthRow,
       "selected",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "darker",
       darkerRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
   }
 
   _buildIconThemeGroup() {
     const iconThemeGroup = new Adw.PreferencesGroup({
       title: _("Icon Theme"),
     });
     this.add(iconThemeGroup);
 
     const iconThemeFolderRow = new Adw.ExpanderRow({
       title: _("Folder icon theme"),
       subtitle: _("Applies the accent color to folder icons."),
       show_enable_switch: true,
     });
     iconThemeGroup.add(iconThemeFolderRow);
 
     const iconThemeAppRow = new Adw.SwitchRow({
       title: _("Application icon theme"),
       subtitle: _("Applies the accent color to some app icons."),
     });
 
     const morewaitaRow = new Adw.SwitchRow({
       title: _("MoreWaita"),
       subtitle: _("Applies integration with the MoreWaita icon pack."),
     });
 
     iconThemeFolderRow.add_row(iconThemeAppRow);
     iconThemeFolderRow.add_row(morewaitaRow);
 
     this._settings.bind(
       "recolor-folders",
       iconThemeFolderRow,
       "enable-expansion",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "recolor-apps",
       iconThemeAppRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     this._settings.bind(
       "morewaita",
       morewaitaRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     iconThemeFolderRow.bind_property(
       "enable-expansion",
       iconThemeFolderRow,
       "expanded",
       GObject.BindingFlags.SYNC_CREATE,
     );
   }
 
   _buildCustomCssGroup() {
     const customCssGroup = new Adw.PreferencesGroup({
       title: _("Customization"),
     });
     this.add(customCssGroup);
 
     const customCssRow = new Adw.ActionRow({
       title: _("Custom stylesheet"),
       subtitle: _(
         "A file that overrides the CSS of the shell and user extensions, with support for ChromaLeon accent colors.",
       ),
     });
 
     const customCssSwitch = new Gtk.Switch({
       valign: Gtk.Align.CENTER,
     });
     customCssRow.activatable_widget = customCssSwitch;
 
     this._settings.bind(
       "custom-css",
       customCssSwitch,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     const infoButton = new Gtk.Button({
       valign: Gtk.Align.CENTER,
       icon_name: "help-about-symbolic",
       tooltip_text: _("About the custom stylesheet"),
     });
     infoButton.add_css_class("flat");
 
     const openCssButton = new Gtk.Button({
       valign: Gtk.Align.CENTER,
       child: new Gtk.Label({ label: _("Open file") }),
     });
 
     customCssRow.add_suffix(infoButton);
     customCssRow.add_suffix(openCssButton);
     customCssRow.add_suffix(customCssSwitch);
     customCssGroup.add(customCssRow);
 
     infoButton.connect("clicked", () => {
       const dialog = new Adw.MessageDialog({
         transient_for: this._window,
         heading: _("About the custom stylesheet"),
         body: _(
           "This file is used to apply custom CSS to GNOME Shell.\n\n" +
             "The extension processes all content within this file, replacing the <b><tt>@@ACCENT@@</tt></b> and <b><tt>-st-accent-color</tt></b> variables with the color selected in the ChromaLeon settings before applying them to the system. This can be useful if an extension does not have the accent colors applied correctly.\n\n" +
             "<b>Tip:</b> If your changes do not take effect, try adding <b><tt>!important</tt></b> to your CSS rules.",
         ),
         body_use_markup: true,
         close_response: "cancel",
       });
       dialog.add_response("close", _("Close"));
       dialog.connect("response", (d) => {
         d.destroy();
       });
       dialog.present();
     });
 
     openCssButton.connect("clicked", () => {
       const homeDir = GLib.get_home_dir();
       const file = Gio.File.new_for_path(
         `${homeDir}/.config/ChromaLeon/custom.css`,
       );
       const uri = file.get_uri();
 
       Gio.AppInfo.launch_default_for_uri_async(
         uri,
         null,
         null,
         (source, result) => {
           try {
             Gio.AppInfo.launch_default_for_uri_finish(result);
           } catch (error) {
             throw new Error(_("Failed to open custom.css: " + error.message));
           }
         },
       );
     });
   }
 
   _buildMiscGroup() {
     const miscellaneousGroup = new Adw.PreferencesGroup({
       title: _("Miscellaneous"),
     });
     this.add(miscellaneousGroup);
 
     const hotReloadStringList = Gtk.StringList.new([
       _("Disabled"),
       _("Default (recommended)"),
       _("Smooth (experimental)"),
     ]);
 
     const hotReloadRow = new Adw.ComboRow({
       title: _("Hot Reload"),
       subtitle: _("Enables theme hot reloading for GTK4 applications."),
       model: hotReloadStringList,
     });
     miscellaneousGroup.add(hotReloadRow);
 
     const hotReloadInfoButton = new Gtk.Button({
       valign: Gtk.Align.CENTER,
       icon_name: "help-about-symbolic",
       tooltip_text: _("About the custom stylesheet"),
     });
     hotReloadInfoButton.add_css_class("flat");
     hotReloadRow.add_suffix(hotReloadInfoButton);
 
     hotReloadInfoButton.connect("clicked", () => {
       const dialog = new Adw.MessageDialog({
         transient_for: this._window,
         heading: _("About Hot Reload"),
         body: _(
           "Hot reload uses rapid switching between the high contrast theme and the default theme to force GTK4 applications to reload the stylesheet.\n\n" +
             "<b>Default reload:</b> This is the recommended, native option. While it may cause flickering during the switch in some cases, it is the safest option and the one least prone to issues during the transition.\n\n" +
             "<b>Smooth reload:</b> This option uses a subprocess to speed up execution, drastically reducing flickering when switching themes. However, it is the least reliable option, as it can lead to errors such as failed reloads or getting stuck on the high contrast theme (or vice versa, if you use GNOME with that style enabled).\n\n" +
             "<b>Note:</b> This does not apply to native GNOME accent colors, as it is not necessary for them.",
         ),
         body_use_markup: true,
         close_response: "cancel",
       });
       dialog.add_response("close", _("Close"));
       dialog.connect("response", (d) => {
         d.destroy();
       });
       dialog.present();
     });
 
     this._settings.bind(
       "hot-reload",
       hotReloadRow,
       "selected",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     const flatpakRow = new Adw.SwitchRow({
       title: _("Apply to Flatpaks"),
       subtitle: _(
         "Allow Flatpaks to access your custom accent color variables.",
       ),
     });
     miscellaneousGroup.add(flatpakRow);
 
     const shortcutRow = new Adw.SwitchRow({
       title: _("Enable shortcut"),
       subtitle: _(
         "Create a shortcut in the app grid by adding a .desktop file.",
       ),
     });
     miscellaneousGroup.add(shortcutRow);
 
     this._settings.bind(
       "create-shortcut",
       shortcutRow,
       "active",
       Gio.SettingsBindFlags.DEFAULT,
     );
 
     const checkFlatpakPermissions = () => {
       try {
         const proc = Gio.Subprocess.new(
           ["flatpak", "override", "--user", "--show"],
           Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
         );
 
         const [, stdoutData] = proc.communicate_utf8(null, null);
         if (!stdoutData) return false;
 
         const match = stdoutData.match(/^filesystems=(.*)$/m);
         if (!match) return false;
 
         const entries = match[1].split(";").map((e) => e.trim());
         const hasGtk3 = entries.some((e) =>
           /^xdg-config\/gtk-3\.0(:[a-z-]+)?$/.test(e),
         );
         const hasGtk4 = entries.some((e) =>
           /^xdg-config\/gtk-4\.0(:[a-z-]+)?$/.test(e),
         );
 
         return hasGtk3 && hasGtk4;
       } catch (e) {
         return false;
       }
     };
 
     flatpakRow.set_active(checkFlatpakPermissions());
     flatpakRow.connect("notify::active", () => {
       const isActive = flatpakRow.get_active();
       const commands = isActive
         ? [
             [
               "flatpak",
               "override",
               "--user",
               "--filesystem=xdg-config/gtk-3.0",
             ],
             [
               "flatpak",
               "override",
               "--user",
               "--filesystem=xdg-config/gtk-4.0",
             ],
           ]
         : [
             [
               "flatpak",
               "override",
               "--user",
               "--nofilesystem=xdg-config/gtk-3.0",
             ],
             [
               "flatpak",
               "override",
               "--user",
               "--nofilesystem=xdg-config/gtk-4.0",
             ],
           ];
       commands.forEach((cmd) => {
         Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
       });
     });
   }
 }