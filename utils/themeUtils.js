import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { applyAccentTheme } from "./recolorUtils.js";

const GTK_VERSIONS = ["gtk-3.0", "gtk-4.0"];
const REGEX_MARKER =
  /\/\* CustomAccentExtension Start \*\/[\s\S]*?\/\* CustomAccentExtension End \*\/\n?/g;
const START_MARKER = "/* CustomAccentExtension Start */";
const END_MARKER = "/* CustomAccentExtension End */";

export function removeShellStylesheet(generatedCssFile) {
  let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
  if (theme && generatedCssFile) {
    theme.unload_stylesheet(generatedCssFile);
  }
  return null;
}

export function removeGtkStylesheet() {
  const configDir = GLib.get_user_config_dir();

  GTK_VERSIONS.forEach((version) => {
    let dirPath = `${configDir}/${version}`;

    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    if (accentFile.query_exists(null)) {
      accentFile.delete_async(GLib.PRIORITY_DEFAULT, null, (f, res) => {
        try {
          f.delete_finish(res);
        } catch (e) {}
      });
    }

    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    if (mainFile.query_exists(null)) {
      mainFile.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          if (!ok) return;

          let mainContent = new TextDecoder().decode(contents);
          let newContent = mainContent.replace(REGEX_MARKER, "").trim();

          file.replace_contents_async(
            new TextEncoder().encode(newContent),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (f, r) => {
              try {
                f.replace_contents_finish(r);
              } catch (e) {}
            },
          );
        } catch (e) {}
      });
    }
  });
}

export function updateShellStylesheet(
  extensionPath,
  color,
  currentCssFile,
  onUpdated,
  isLight,
  tinted,
) {
  const shellAccentTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/shell_accent.template.css`,
  );

  const tintedDarkTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_dark.template.css`,
  );

  const tintedLightTemplate = Gio.File.new_for_path(
    `${extensionPath}/templates/tinted_light.template.css`,
  );

  let tintedTemplate = isLight ? tintedLightTemplate : tintedDarkTemplate;
  let finalTemplate = tinted ? tintedTemplate : shellAccentTemplate;

  finalTemplate.load_contents_async(null, (file, res) => {
    try {
      let [ok, contents] = file.load_contents_finish(res);
      if (!ok) return;

      let template = new TextDecoder().decode(contents);
      let css = template.replace(/@@ACCENT@@/g, color);

      let cacheDir = GLib.get_user_cache_dir();
      let outputFile = Gio.File.new_for_path(
        `${cacheDir}/chromaleon-shell.css`,
      );

      outputFile.replace_contents_async(
        new TextEncoder().encode(css),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (f, r) => {
          try {
            f.replace_contents_finish(r);
            removeShellStylesheet(currentCssFile);

            let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            if (theme) {
              theme.load_stylesheet(outputFile);
              if (onUpdated) onUpdated(outputFile);
            }
          } catch (e) {}
        },
      );
    } catch (e) {}
  });
}

export function updateGtkStylesheet(
  extensionPath,
  color,
  tinted,
  isDark,
  tintGTK3,
) {
  const configDir = GLib.get_user_config_dir();
  const cssBlock = `${START_MARKER}\n@import url("custom-accent.css");\n${END_MARKER}`;
  const cssVars = `@define-color accent_color ${color};\n@define-color accent_bg_color ${color};\n`;

  const tintedGtk3LightStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk3_light_tinted.template.css`,
  );
  const tintedGtk3DarkStyle = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk3_dark_tinted.template.css`,
  );
  const tintedGtk4Style = Gio.File.new_for_path(
    `${extensionPath}/templates/gtk4_tinted.template.css`,
  );

  const writeAccentFile = (accentFile, content) => {
    accentFile.replace_contents_async(
      new TextEncoder().encode(content),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      (f, r) => {
        try {
          f.replace_contents_finish(r);
        } catch (e) {}
      },
    );
  };

  const gtk4 = () => {
    let dirPath = `${configDir}/gtk-4.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);

    if (tinted) {
      tintedGtk4Style.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          if (!ok) return;

          let template = new TextDecoder().decode(contents);
          let css = template.replace(/@@ACCENT@@/g, color);
          writeAccentFile(accentFile, `${cssVars}\n${css}`);
        } catch (e) {}
      });
    } else {
      writeAccentFile(accentFile, cssVars);
    }

    const writeMainFile = (content) => {
      mainFile.replace_contents_async(
        new TextEncoder().encode(content),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (f, r) => {
          try {
            f.replace_contents_finish(r);
          } catch (e) {}
        },
      );
    };

    if (mainFile.query_exists(null)) {
      mainFile.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          let mainContent = ok ? new TextDecoder().decode(contents) : "";
          let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();

          writeMainFile(`${cleanContent}\n\n${cssBlock}\n`);
        } catch (e) {}
      });
    } else {
      writeMainFile(`${cssBlock}\n`);
    }
  };

  const gtk3 = () => {
    let dirPath = `${configDir}/gtk-3.0`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);

    if (tinted && tintGTK3) {
      if (isDark) {
        tintedGtk3DarkStyle.load_contents_async(null, (file, res) => {
          try {
            let [ok, contents] = file.load_contents_finish(res);
            if (!ok) return;

            let template = new TextDecoder().decode(contents);
            let css = template.replace(/@@ACCENT@@/g, color);
            writeAccentFile(accentFile, `${cssVars}\n${css}`);
          } catch (e) {}
        });
      } else {
        tintedGtk3LightStyle.load_contents_async(null, (file, res) => {
          try {
            let [ok, contents] = file.load_contents_finish(res);
            if (!ok) return;

            let template = new TextDecoder().decode(contents);

            let css = template.replace(/@@ACCENT@@/g, color);

            writeAccentFile(accentFile, `${cssVars}\n${css}`);
          } catch (e) {}
        });
      }
    } else {
      writeAccentFile(accentFile, cssVars);
    }

    const writeMainFile = (content) => {
      mainFile.replace_contents_async(
        new TextEncoder().encode(content),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (f, r) => {
          try {
            f.replace_contents_finish(r);
          } catch (e) {}
        },
      );
    };

    if (mainFile.query_exists(null)) {
      mainFile.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          let mainContent = ok ? new TextDecoder().decode(contents) : "";
          let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();

          writeMainFile(`${cleanContent}\n\n${cssBlock}\n`);
        } catch (e) {}
      });
    } else {
      writeMainFile(`${cssBlock}\n`);
    }
  };

  gtk4();
  gtk3();
}

export async function updateIconPack(hex, iconFolders, iconApps, morewaita) {
  const settings = new Gio.Settings({
    schema_id: "org.gnome.desktop.interface",
  });

  if (!iconFolders) {
    settings.set_string("icon-theme", "Adwaita");
    return;
  }

  await applyAccentTheme(hex, {
    applyApps: iconApps,
    useMoreWaita: morewaita,
  });
}
