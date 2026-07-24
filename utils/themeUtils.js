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
import { throwIfCancelled, isCancelledError } from "./cancellation.js";

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
  "replace_contents_bytes_async",
  "replace_contents_finish",
);
Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");
Gio._promisify(
  Gio.OutputStream.prototype,
  "write_bytes_async",
  "write_bytes_finish",
);
Gio._promisify(Gio.OutputStream.prototype, "close_async", "close_finish");

async function writeFile(file, content, cancellable) {
  throwIfCancelled(cancellable);

  const bytes = GLib.Bytes.new(new TextEncoder().encode(content));

  await file.replace_contents_bytes_async(
    bytes,
    null,
    false,
    Gio.FileCreateFlags.NONE,
    cancellable,
  );
}

export function removeShellStylesheet(generatedCssFile) {
  let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
  if (theme && generatedCssFile) {
    theme.unload_stylesheet(generatedCssFile);
  }
  return null;
}

export function removeGtkStylesheet() {
  const configDir = GLib.get_user_config_dir();

  for (const version of GTK_VERSIONS) {
    let dirPath = `${configDir}/${version}`;

    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    if (accentFile.query_exists(null)) {
      try {
        accentFile.delete(null);
      } catch (e) {}
    }

    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    if (mainFile.query_exists(null)) {
      try {
        let [ok, contents] = mainFile.load_contents(null);
        if (ok) {
          let mainContent = new TextDecoder().decode(contents);
          let newContent = mainContent.replace(REGEX_MARKER, "").trim();

          let safeContent = newContent ? `${newContent}\n` : "";
          let bytes = GLib.Bytes.new(new TextEncoder().encode(safeContent));

          mainFile.replace_contents(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
          );
        }
      } catch (e) {}
    }
  }
}

export async function updateShellStylesheet(
  extensionPath,
  color,
  tinted,
  darker,
  customStyle,
  gnomeColors,
  cancellable,
) {
  throwIfCancelled(cancellable);

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

  const fileLight = tinted ? tintedLightTemplate : shellAccentTemplate;
  const fileDark = tinted
    ? darker
      ? tintedDarkerTemplate
      : tintedDarkTemplate
    : shellAccentTemplate;

  const generateAndApplyFiles = async (customCssContents) => {
    try {
      let [contentsLight] = await fileLight.load_contents_async(cancellable);
      let [contentsDark] = await fileDark.load_contents_async(cancellable);

      let textLight = new TextDecoder().decode(contentsLight);
      let textDark = new TextDecoder().decode(contentsDark);

      let finalLightContent = customCssContents
        ? `${textLight}\n${customCssContents}`
        : textLight;
      let finalDarkContent = customCssContents
        ? `${textDark}\n${customCssContents}`
        : textDark;

      let accentValue = gnomeColors ? "-st-accent-color" : color;

      let cssLight = finalLightContent
        .replace(/@@ACCENT@@/g, accentValue)
        .replace(/-st-accent-color/g, accentValue);

      let cssDark = finalDarkContent
        .replace(/@@ACCENT@@/g, accentValue)
        .replace(/-st-accent-color/g, accentValue);

      let cacheDir = GLib.get_user_cache_dir();
      let outputFile = Gio.File.new_for_path(
        `${cacheDir}/chromaleon-shell.css`,
      );
      let outputFileDark = Gio.File.new_for_path(
        `${cacheDir}/chromaleon-shell-dark.css`,
      );

      await writeFile(outputFile, cssLight, cancellable);
      await writeFile(outputFileDark, cssDark, cancellable);

      throwIfCancelled(cancellable);
    } catch (e) {
      if (isCancelledError(e)) throw e;
    }
  };

  if (customCss.query_exists(null)) {
    if (customStyle) {
      let customCssContents = null;
      try {
        let [contents] = await customCss.load_contents_async(cancellable);
        customCssContents = new TextDecoder().decode(contents);
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
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
      await writeFile(customCss, templateHeader, cancellable);
    } catch (e) {
      if (isCancelledError(e)) throw e;
    }
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
  cancellable,
) {
  throwIfCancelled(cancellable);

  const configDir = GLib.get_user_config_dir();
  const cssBlock = `${START_MARKER}\n@import url("custom-accent.css");\n${END_MARKER}`;
  const cssVars = `@define-color accent_color ${color};\n@define-color accent_bg_color ${color};\n`;

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

  const gtk4 = async () => {
    let dirPath = `${configDir}/gtk-4.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);

    const parentDir = Gio.File.new_for_path(dirPath);

    if (!parentDir.query_exists(null)) {
      try {
        parentDir.make_directory_with_parents(null);
        await writeFile(mainFile, "", cancellable);
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    }

    if (tinted) {
      let tintedGtk4Template = darker ? tintedGtk4DarkerStyle : tintedGtk4Style;
      try {
        let [contents] =
          await tintedGtk4Template.load_contents_async(cancellable);

        let template = new TextDecoder().decode(contents);
        let css = template.replace(
          /@@ACCENT@@/g,
          gnomeColors ? "@accent_bg_color" : color,
        );

        await writeFile(
          accentFile,
          !gnomeColors ? `${cssVars}\n${css}` : css,
          cancellable,
        );
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    } else {
      gnomeColors
        ? await writeFile(accentFile, "", cancellable)
        : await writeFile(accentFile, cssVars, cancellable);
    }

    throwIfCancelled(cancellable);

    if (mainFile.query_exists(null)) {
      try {
        let [contents] = await mainFile.load_contents_async(cancellable);
        let mainContent = new TextDecoder().decode(contents);

        if (!mainContent.includes(START_MARKER)) {
          let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();
          await writeFile(
            mainFile,
            `${cleanContent}\n\n${cssBlock}\n`,
            cancellable,
          );
        }
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    } else {
      await writeFile(mainFile, `${cssBlock}\n`, cancellable);
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
        await writeFile(mainFile, "", cancellable);
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    }

    if (tinted && tintGTK3) {
      let tintedGtk3Template = isDark
        ? darker
          ? tintedGtk3DarkerStyle
          : tintedGtk3DarkStyle
        : tintedGtk3LightStyle;

      try {
        let [contents] =
          await tintedGtk3Template.load_contents_async(cancellable);

        let template = new TextDecoder().decode(contents);
        let css = template.replace(
          /@@ACCENT@@/g,
          gnomeColors ? "@accent_bg_color" : color,
        );

        await writeFile(
          accentFile,
          !gnomeColors ? `${cssVars}\n${css}` : css,
          cancellable,
        );
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    } else {
      await writeFile(accentFile, cssVars, cancellable);
    }

    throwIfCancelled(cancellable);

    if (mainFile.query_exists(null)) {
      try {
        let [contents] = await mainFile.load_contents_async(cancellable);
        let mainContent = new TextDecoder().decode(contents);

        if (!mainContent.includes(START_MARKER)) {
          let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();
          await writeFile(
            mainFile,
            `${cleanContent}\n\n${cssBlock}\n`,
            cancellable,
          );
        }
      } catch (e) {
        if (isCancelledError(e)) throw e;
      }
    } else {
      gnomeColors
        ? await writeFile(accentFile, "", cancellable)
        : await writeFile(accentFile, cssVars, cancellable);
    }
  };

  await gtk4();
  throwIfCancelled(cancellable);
  await gtk3();
}

export async function updateIconPack(
  hex,
  iconFolders,
  iconApps,
  morewaita,
  gnomeColors,
  cancellable,
) {
  throwIfCancelled(cancellable);

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

  await applyAccentTheme(
    color,
    {
      applyApps: iconApps,
      useMoreWaita: morewaita,
    },
    cancellable,
  );
}
