import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

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
      try {
        accentFile.delete(null);
      } catch (e) {}
    }

    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    if (mainFile.query_exists(null)) {
      mainFile.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          if (!ok) return;

          let mainContent = new TextDecoder().decode(contents);
          let newContent = mainContent.replace(REGEX_MARKER, "").trim();

          file.replace_contents(
            newContent,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
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
  isDark,
  tinted,
) {
  const shellAccentTemplate = Gio.File.new_for_path(
    `${extensionPath}/shell_accent.template.css`,
  );

  const tintedDarkTemplate = Gio.File.new_for_path(
    `${extensionPath}/tinted_dark.template.css`,
  );

  const tintedStyle = Gio.File.new_for_path(
    `${extensionPath}/tinted_light.template.css`,
  );

  let tintedTemplate = isDark ? tintedDarkTemplate : tintedStyle;
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

      outputFile.replace_contents(
        css,
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
  });
}

export function updateGtkStylesheet(extensionPath, color, tinted) {
  const configDir = GLib.get_user_config_dir();
  const cssBlock = `${START_MARKER}\n@import url("custom-accent.css");\n${END_MARKER}`;
  const cssVars = `@define-color accent_color ${color};\n@define-color accent_bg_color ${color};\n`;
  let finalCss = "";

  GTK_VERSIONS.forEach((version) => {
    let dirPath = `${configDir}/${version}`;
    let mainFile = Gio.File.new_for_path(`${dirPath}/gtk.css`);
    let accentFile = Gio.File.new_for_path(`${dirPath}/custom-accent.css`);
    const tintedAdwaitaStyle = Gio.File.new_for_path(
      `${extensionPath}/adwaita_tinted.template.css`,
    );

    if (tinted) {
      tintedAdwaitaStyle.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          if (!ok) return;
    
          let template = new TextDecoder().decode(contents);
          let css = template.replace(/@@ACCENT@@/g, color);
  
          finalCss = `${cssVars}\n${css}`;

          try {
            accentFile.replace_contents(
              finalCss,
              null,
              false,
              Gio.FileCreateFlags.REPLACE_DESTINATION,
              null,
            );
          } catch (e) {}
        } catch (e) {}
      }, null);
    } else {
      finalCss = cssVars;
      try {
        accentFile.replace_contents(
          finalCss,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );
      } catch (e) {}
    }

    if (mainFile.query_exists(null)) {
      mainFile.load_contents_async(null, (file, res) => {
        try {
          let [ok, contents] = file.load_contents_finish(res);
          let mainContent = ok ? new TextDecoder().decode(contents) : "";
          let cleanContent = mainContent.replace(REGEX_MARKER, "").trim();
          let newContent = `${cleanContent}\n\n${cssBlock}\n`;

          file.replace_contents(
            newContent,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
          );
        } catch (e) {}
      });
    } else {
      try {
        mainFile.replace_contents(
          `${cssBlock}\n`,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );
      } catch (e) {}
    }
  });
}
