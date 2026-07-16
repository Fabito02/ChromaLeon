/*
 * themeUtils.js
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

import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { applyAccentTheme } from "./recolorUtils.js";

const GTK_VERSIONS = ["gtk-3.0", "gtk-4.0"];
const REGEX_MARKER =
  /\/\* CustomAccentExtension Start \*\/[\s\S]*?\/\* CustomAccentExtension End \*\/\n?/g;
const START_MARKER = "/* CustomAccentExtension Start */";
const END_MARKER = "/* CustomAccentExtension End */";
const GNOME_ACCENTS_HEX = {
  blue: "#3584e4",
  teal: "#2190a4",
  green: "#3a944a",
  yellow: "#c88800",
  orange: "#ed5b00",
  red: "#e62d42",
  pink: "#d56199",
  purple: "#9141ac",
  slate: "#6f8396",
};

Gio._promisify(Gio.File.prototype, "replace_async", "replace_finish");
Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);
Gio._promisify(
  Gio.File.prototype,
  "replace_contents_async",
  "replace_contents_finish",
);
Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");

export function removeShellStylesheet(generatedCssFile) {
  let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
  if (theme && generatedCssFile) {
    theme.unload_stylesheet(generatedCssFile);
  }
  return null;
}

export async function removeGtkStylesheet() {
  const configDir = GLib.get_user_config_dir();

  for (const version of GTK_VERSIONS) {
    let dirPath = `${configDir}/${version}`;

    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    if (accentFile.query_exists(null)) {
      try {
        await accentFile.delete_async(GLib.PRIORITY_DEFAULT, null);
      } catch (e) {}
    }

    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    if (mainFile.query_exists(null)) {
      try {
        let [contents] = await mainFile.load_contents_async(null);

        let mainContent = new TextDecoder().decode(contents);
        let newContent = mainContent.replace(REGEX_MARKER, "").trim();

        await mainFile.replace_contents_async(
          new TextEncoder().encode(newContent),
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );
      } catch (e) {}
    }
  }
}

export async function updateShellStylesheet(
  extensionPath,
  color,
  currentCssFile,
  onUpdated,
  isLight,
  tinted,
  darker,
  customStyle,
  gnomeColors,
) {
  if (gnomeColors) color = "-st-accent-color";

  const homeDir = GLib.get_home_dir();

  const customCss = Gio.File.new_for_path(
    `${homeDir}/.config/ChromaLeon/custom.css`,
  );

  const shellAccentTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/shell_accent.template.css`,
  );

  const tintedDarkTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_dark.template.css`,
  );

  const tintedLightTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_light.template.css`,
  );

  const tintedDarkerTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_darker.template.css`,
  );

  let tintedTemplate = isLight
    ? tintedLightTemplate
    : darker
      ? tintedDarkerTemplate
      : tintedDarkTemplate;
  let finalTemplate = tinted ? tintedTemplate : shellAccentTemplate;

  const generateAndApplyFiles = async (customCssContents) => {
    try {
      let [contents] = await finalTemplate.load_contents_async(null);

      let template = new TextDecoder().decode(contents);
      let finalTemplateContent = customCssContents
        ? `${template}\n${customCssContents}`
        : template;

      let css = finalTemplateContent
        .replace(/@@ACCENT@@/g, color)
        .replace(/-st-accent-color/g, color);

      let cacheDir = GLib.get_user_cache_dir();
      let outputFile = Gio.File.new_for_path(
        `${cacheDir}/chromaleon-shell.css`,
      );

      await outputFile.replace_contents_async(
        new TextEncoder().encode(css),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );

      removeShellStylesheet(currentCssFile);

      let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
      if (theme) {
        theme.load_stylesheet(outputFile);
        if (onUpdated) onUpdated(outputFile);
      }
    } catch (e) {}
  };

  if (customCss.query_exists(null)) {
    if (customStyle) {
      let customCssContents = null;
      try {
        let [contents] = await customCss.load_contents_async(null);
        customCssContents = new TextDecoder().decode(contents);
      } catch (e) {}
      await generateAndApplyFiles(customCssContents);
    } else {
      await generateAndApplyFiles(null);
    }
  } else {
    try {
      const parentDir = customCss.get_parent();
      if (parentDir && !parentDir.query_exists(null)) {
        parentDir.make_directory_with_parents(null);
      }

      const templateHeader = `/*\n* ChromaLeon Shell — Custom User Styles\n*/`;
      await customCss.replace_contents_async(
        new TextEncoder().encode(templateHeader),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
    } catch (e) {}
    await generateAndApplyFiles(null);
  }
}

export async function updateGtkStylesheet(
  extensionPath,
  color,
  tinted,
  isDark,
  tintGTK3,
  darker,
  gnomeColors,
) {

  const configDir = GLib.get_user_config_dir();
  const cssBlock = `${START_MARKER}\n@import url("custom-accent.css");\n${END_MARKER}`;
  const cssVars = `@define-color accent_color ${color};\n@define-color accent_bg_color ${color};\n`;
  const cssVarsGnome = `@define-color accent_color ${GNOME_ACCENTS_HEX[color]};\n@define-color accent_bg_color ${GNOME_ACCENTS_HEX[color]};\n`;

  const tintedGtk3LightStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk3_light_tinted.template.css`,
  );
  const tintedGtk3DarkStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk3_dark_tinted.template.css`,
  );
  const tintedGtk3DarkerStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk3_darker_tinted.template.css`,
  );
  const tintedGtk4Style = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk4_tinted.template.css`,
  );
  const tintedGtk4DarkerStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk4_darker_tinted.template.css`,
  );

  const writeAccentFile = async (accentFile, content) => {
    await accentFile.replace_contents_async(
      new TextEncoder().encode(content),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  };

  const gtk4 = async () => {
    let dirPath = `${configDir}/gtk-4.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);

    const parentDir = Gio.File.new_for_path(dirPath);

    if (!parentDir.query_exists(null)) {
      try {
        parentDir.make_directory_with_parents(null);

        await mainFile.replace_contents_async(
          new TextEncoder().encode(""),
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
        );
      } catch (e) {}
    }

    if (tinted) {
      let tintedGtk4Template = tintedGtk4Style;
      if (darker) tintedGtk4Template = tintedGtk4DarkerStyle;
      try {
        let [contents] = await tintedGtk4Template.load_contents_async(null);

        let template = new TextDecoder().decode(contents);
        let css = template.replace(/@@ACCENT@@/g, color);
        await writeAccentFile(
          accentFile,
          !gnomeColors ? `${cssVars}\n${css}` : css,
        );
      } catch (e) {}
    } else {
      await writeAccentFile(accentFile, !gnomeColors ? cssVars : "");
    }

    const writeMainFile = async (content) => {
      await mainFile.replace_contents_async(
        new TextEncoder().encode(content),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
    };

    if (mainFile.query_exists(null)) {
      try {
        let [contents] = await mainFile.load_contents_async(null);
        let mainContent = new TextDecoder().decode(contents);
        let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();

        await writeMainFile(`${cleanContent}\n\n${cssBlock}\n`);
      } catch (e) {}
    } else {
      await writeMainFile(`${cssBlock}\n`);
    }
  };

  const gtk3 = async () => {
    let dirPath = `${configDir}/gtk-3.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);

    const parentDir = Gio.File.new_for_path(dirPath);

    if (!parentDir.query_exists(null)) {
      try {
        parentDir.make_directory_with_parents(null);

        await mainFile.replace_contents_async(
          new TextEncoder().encode(""),
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
        );
      } catch (e) {}
    }

    if (tinted && tintGTK3) {
      if (isDark) {
        let tintedGtk3Template = tintedGtk3DarkStyle;
        if (darker) tintedGtk3Template = tintedGtk3DarkerStyle;
        try {
          let [contents] = await tintedGtk3Template.load_contents_async(null);

          let template = new TextDecoder().decode(contents);
          let css = template.replace(/@@ACCENT@@/g, color);
          await writeAccentFile(
            accentFile,
            !gnomeColors ? `${cssVars}\n${css}` : `${cssVarsGnome}\n${css}`,
          );
        } catch (e) {}
      } else {
        try {
          let [contents] = await tintedGtk3LightStyle.load_contents_async(null);

          let template = new TextDecoder().decode(contents);
          let css = template.replace(/@@ACCENT@@/g, color);

          await writeAccentFile(
            accentFile,
            !gnomeColors ? `${cssVars}\n${css}` : css,
          );
        } catch (e) {}
      }
    } else {
      await writeAccentFile(accentFile, cssVars);
    }

    const writeMainFile = async (content) => {
      await mainFile.replace_contents_async(
        new TextEncoder().encode(content),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
    };

    if (mainFile.query_exists(null)) {
      try {
        let [contents] = await mainFile.load_contents_async(null);
        let mainContent = new TextDecoder().decode(contents);
        let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();

        await writeMainFile(`${cleanContent}\n\n${cssBlock}\n`);
      } catch (e) {}
    } else {
      await writeMainFile(`${cssBlock}\n`);
    }
  };

  await gtk4();
  await gtk3();
}

export async function updateIconPack(
  hex,
  iconFolders,
  iconApps,
  morewaita,
  gnomeColors,
) {
  let color = hex;

  if (gnomeColors) {
    let interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });
    let colorName = interfaceSettings.get_string("accent-color");

    const hexColor = GNOME_ACCENTS_HEX[colorName];
    color = hexColor;
  }

  const settings = new Gio.Settings({
    schema_id: "org.gnome.desktop.interface",
  });

  if (!iconFolders) {
    settings.set_string("icon-theme", "Adwaita");
    return;
  }

  await applyAccentTheme(color, {
    applyApps: iconApps,
    useMoreWaita: morewaita,
  });
}
