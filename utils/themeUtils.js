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
import { throwIfCancelled } from "./cancellation.js";
import {
  setThemeStylesheet,
  loadTheme,
} from "resource:///org/gnome/shell/ui/main.js";
import { writeFile } from "./fileUtils.js";

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

const getConvertedStrength = (strength, decimal, pct = 10) => {
  if (decimal) {
    switch (strength) {
      case 0:
        return pct - 0.05;
      case 1:
        return pct;
      case 2:
        return pct + 0.05;
      case 3:
        return pct + 0.1;
      default:
        return pct;
    }
  } else {
    switch (strength) {
      case 0:
        return pct - 5;
      case 1:
        return pct;
      case 2:
        return pct + 5;
      case 3:
        return pct + 10;
      default:
        return pct;
    }
  }
};

export const applyShellThemeBase = (generatedCssPath) => {
  if (generatedCssPath) {
    setThemeStylesheet(generatedCssPath);
    loadTheme();
  }
};

export const resetShellThemeBase = () => {
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    setThemeStylesheet(null);
    loadTheme();
    return GLib.SOURCE_REMOVE;
  });
};

export function removeShellStylesheet(cssFile) {
  let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
  if (theme && cssFile) {
    theme.unload_stylesheet(cssFile);
  }
  return null;
}

Gio._promisify(Gio.File.prototype, "replace_async", "replace_finish");
Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);
Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");
Gio._promisify(Gio.OutputStream.prototype, "close_async", "close_finish");

export function removeGtkStylesheet() {
  const configDir = GLib.get_user_config_dir();

  for (const version of GTK_VERSIONS) {
    let dirPath = `${configDir}/${version}`;

    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    if (accentFile.query_exists(null)) {
      accentFile.delete(null);
    }

    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    if (mainFile.query_exists(null)) {
      let [ok, contents] = mainFile.load_contents(null);
      if (ok) {
        let mainContent = new TextDecoder().decode(contents);
        let newContent = mainContent.replace(REGEX_MARKER, "").trim();

        let safeContent = newContent ? `${newContent}\n` : "";

        let buffer = new TextEncoder().encode(safeContent);

        mainFile.replace_contents(
          buffer,
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
        );
      }
    }
  }
}

export async function updateShellStylesheet(
  extensionPath,
  color,
  tinted,
  darker,
  gnomeColors,
  tintPanel,
  tintStrength,
  fullLight,
  cancellable,
) {
  throwIfCancelled(cancellable);

  if (gnomeColors) color = "-st-accent-color";

  const homeDir = GLib.get_home_dir();

  let accentValue = gnomeColors ? "-st-accent-color" : color;

  const panelStyle = (colorBg, pctBg, colorShadow, pctShadow) =>
    tintPanel
      ? `#panel {\n      background-color: st-mix(${accentValue}, ${colorBg}, ${pctBg});\n      box-shadow: inset 0 -0.5px 0 0 st-mix(${accentValue}, ${colorShadow}, ${pctShadow}%);\n    }\n\n`
      : "";

  let cssPanel = "";
  let cssPanelDark = "";
  let cssPanelDarker = "";

  if (tinted) {
    cssPanel = panelStyle(
      "#fafafb",
      `${getConvertedStrength(tintStrength, false, 12)}%`,
      "rgba(34, 34, 38, 0.1)",
      5,
    );
    cssPanelDark = panelStyle(
      "#1b1b1d",
      `${getConvertedStrength(tintStrength, false)}%`,
      "rgba(46, 46, 50, 0.55)",
      7,
    );
    cssPanelDarker = panelStyle(
      "#0f0f10",
      `${getConvertedStrength(tintStrength, false)}%`,
      "rgba(34, 34, 38, 0.65)",
      7,
    );
  }

  const customStylesheetFile = Gio.File.new_for_path(
    `${homeDir}/.config/ChromaLeon/custom.css`,
  );

  const shellAccentTemplateLight = Gio.File.new_for_path(
    `${extensionPath}/templates/shell_accent_light.template.css`,
  );

  const shellAccentTemplateFullLight = Gio.File.new_for_path(
    `${extensionPath}/templates/light_full.template.css`,
  );

  const shellAccentTemplateDark = Gio.File.new_for_path(
    `${extensionPath}/templates/shell_accent_dark.template.css`,
  );

  const tintedDarkTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_dark.template.css`,
  );

  const tintedLightTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_light.template.css`,
  );

  const tintedLightFullTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_light_full.template.css`,
  );

  const tintedDarkerTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_darker.template.css`,
  );

  const fileLight = tinted
    ? fullLight
      ? tintedLightFullTemplate
      : tintedLightTemplate
    : fullLight
      ? shellAccentTemplateFullLight
      : shellAccentTemplateLight;
  const fileDark = tinted
    ? darker
      ? tintedDarkerTemplate
      : tintedDarkTemplate
    : shellAccentTemplateDark;

  if (!customStylesheetFile.query_exists(null)) {
    try {
      const parentDir = customStylesheetFile.get_parent();
      if (parentDir && !parentDir.query_exists(null)) {
        parentDir.make_directory_with_parents(null);
      }

      const templateHeader = `/*\n* ChromaLeon Shell — Custom User Styles\n*/`;
      await writeFile(customStylesheetFile, templateHeader, cancellable);
    } catch (e) {
      if (isCancelledError(e)) throw e;
    }
  }

  const generateAndApplyFiles = async () => {
    try {
      const [[contentsLight], [contentsDark], [contentsCustom]] =
        await Promise.all([
          fileLight.load_contents_async(cancellable),
          fileDark.load_contents_async(cancellable),
          customStylesheetFile.load_contents_async(cancellable),
        ]);

      let textLight = new TextDecoder().decode(contentsLight);
      let textDark = new TextDecoder().decode(contentsDark);
      let textCustom = new TextDecoder().decode(contentsCustom);

      let cssLight = textLight
        .replace(/@@ACCENT@@/g, accentValue)
        .replace(/-st-accent-color/g, accentValue)
        .replace(/@@PANEL@@/g, cssPanel)
        .replace(
          /@@TINT_STRENGTH@@/g,
          `${getConvertedStrength(tintStrength, false, 12)}%`,
        );

      let cssDark = textDark
        .replace(/@@ACCENT@@/g, accentValue)
        .replace(/-st-accent-color/g, accentValue)
        .replace(/@@PANEL@@/g, darker ? cssPanelDarker : cssPanelDark)
        .replace(
          /@@TINT_STRENGTH@@/g,
          `${getConvertedStrength(tintStrength, false)}%`,
        );

      let customStylesheet = textCustom
        .replace(/@@ACCENT@@/g, accentValue)
        .replace(/-st-accent-color/g, accentValue)
        .replace(
          /@@TINT_STRENGTH@@/g,
          `${getConvertedStrength(tintStrength, false)}%`,
        );

      let cacheDir = GLib.get_user_cache_dir();
      let outputFile = Gio.File.new_for_path(
        `${cacheDir}/chromaleon/chromaleon-shell.css`,
      );
      let outputFileDark = Gio.File.new_for_path(
        `${cacheDir}/chromaleon/chromaleon-shell-dark.css`,
      );
      let outputFileCustom = Gio.File.new_for_path(
        `${cacheDir}/chromaleon/chromaleon-shell-custom.css`,
      );

      await Promise.all([
        writeFile(outputFile, cssLight, cancellable),
        writeFile(outputFileDark, cssDark, cancellable),
        writeFile(outputFileCustom, customStylesheet, cancellable),
      ]);

      throwIfCancelled(cancellable);
    } catch (e) {
      if (isCancelledError(e)) throw e;
    }
  };

  await generateAndApplyFiles();
}

export async function updateGtkStylesheet(
  extensionPath,
  color,
  tinted,
  isDark,
  tintGTK3,
  darker,
  gnomeColors,
  tintStrength,
  cancellable,
) {
  throwIfCancelled(cancellable);

  const configDir = GLib.get_user_config_dir();
  const cssBlock = `${START_MARKER}\n@import url("custom-accent.css");\n${END_MARKER}`;

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
    const cssVars = `@define-color accent_bg_color ${color};\n`;

    const parentDir = Gio.File.new_for_path(dirPath);

    if (!parentDir.query_exists(null)) {
      parentDir.make_directory_with_parents(null);
      await writeFile(mainFile, "\n", cancellable);
    } else if (!mainFile.query_exists(null)) {
      await writeFile(mainFile, "\n", cancellable);
    }

    if (tinted) {
      let tintedGtk4Template = darker ? tintedGtk4DarkerStyle : tintedGtk4Style;
        let [contents] =
          await tintedGtk4Template.load_contents_async(cancellable);

        let template = new TextDecoder().decode(contents);
        let css = template
          .replace(
            /@@TINT_STRENGTH@@/g,
            getConvertedStrength(tintStrength, true, 0.12),
          )
          .replace(
            /@@TINT_STRENGTH_DARK@@/g,
            getConvertedStrength(tintStrength, true, 0.1),
          )
          .replace(
            /@@TINT_STRENGTH_CARD@@/g,
            getConvertedStrength(tintStrength, true, 0.06),
          );

        await writeFile(
          accentFile,
          !gnomeColors ? `${cssVars}\n${css}` : css,
          cancellable,
        );
    } else {
      gnomeColors
        ? await writeFile(accentFile, "\n", cancellable)
        : await writeFile(accentFile, cssVars, cancellable);
    }

    throwIfCancelled(cancellable);

    if (mainFile.query_exists(null)) {
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
    } else {
      await writeFile(mainFile, `${cssBlock}\n`, cancellable);
    }
  };

  const gtk3 = async () => {
    let dirPath = `${configDir}/gtk-3.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    let hexColor = gnomeColors ? GNOME_ACCENTS_HEX[color] : color;
    const cssVars = `@define-color accent_bg_color ${hexColor};\n`;

    const parentDir = Gio.File.new_for_path(dirPath);

    if (!parentDir.query_exists(null)) {
      parentDir.make_directory_with_parents(null);
      await writeFile(mainFile, "\n", cancellable);
    } else if (!mainFile.query_exists(null)) {
      await writeFile(mainFile, "\n", cancellable);
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
        let css = template
          .replace(
            /@@TINT_STRENGTH@@/g,
            getConvertedStrength(tintStrength, true, 0.12),
          )
          .replace(
            /@@TINT_STRENGTH_DARK@@/g,
            getConvertedStrength(tintStrength, true, 0.1),
          )
          .replace(
            /@@TINT_STRENGTH_CARD@@/g,
            getConvertedStrength(tintStrength, true, 0.06),
          );

        await writeFile(accentFile, `${cssVars}\n${css}`, cancellable);
      } catch (e) {
        throw e;
      }
    } else {
      await writeFile(accentFile, cssVars, cancellable);
    }

    throwIfCancelled(cancellable);

    if (mainFile.query_exists(null)) {
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
    } else {
      gnomeColors
        ? await writeFile(accentFile, "\n", cancellable)
        : await writeFile(accentFile, cssVars, cancellable);
    }
  };

  await Promise.all([gtk4(), gtk3()]);
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

  if (!iconFolders && settings.get_string("icon-theme") === "ChromaLeon") {
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
