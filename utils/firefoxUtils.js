const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const loadFile = (file) =>
  new Promise((r) =>
    file.load_contents_async(null, (o, res) => {
      try {
        const content = new TextDecoder().decode(
          o.load_contents_finish(res)[1],
        );
        r(content);
      } catch (e) {
        r("");
      }
    }),
  );

const saveFile = (file, text) =>
  new Promise((r) =>
    file.replace_contents_bytes_async(
      GLib.Bytes.new(text),
      null,
      false,
      Gio.FileCreateFlags.NONE,
      null,
      (o, res) => {
        try {
          r(o.replace_contents_finish(res)[0]);
        } catch (e) {
          r(false);
        }
      },
    ),
  );

function generateTargetLines(hexColor) {
  return [
    `user_pref("ui.accentcolor", "${hexColor}");`,
    `user_pref("ui.highlight", "${hexColor}");`,
    `user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);`,
  ];
}

function updateJsContent(content, hexColor, isReset) {
  const cleanupRegex =
    /ui\.accentcolor|ui\.highlight|toolkit\.legacyUserProfileCustomizations\.stylesheets/;

  const cleanLines = content.split("\n").filter((l) => !cleanupRegex.test(l));

  if (!isReset) {
    cleanLines.push(...generateTargetLines(hexColor));
  }

  return cleanLines.join("\n").trim();
}

function generateUserChromeCss(hexColor) {
  return `:root {
    --accent-color: ${hexColor} !important;
    --urlbar-popup-url-color: ${hexColor} !important;
    --autocomplete-popup-highlight-background: ${hexColor} !important;
    --urlbarview-background-color-selected: ${hexColor} !important;
}
.urlbarView-url { color: ${hexColor} !important; }
.urlbarView-row[selected] .urlbarView-title,
.urlbarView-row:hover .urlbarView-title,
.urlbarView-row[selected] .urlbarView-action,
.urlbarView-row:hover .urlbarView-action { color: #ffffff !important; }
.urlbarView-row[selected] .urlbarView-url,
.urlbarView-row:hover .urlbarView-url { color: #f5f5f5 !important; }
menupopup menuitem[_moz-menuactive="true"],
menupopup menu[_moz-menuactive="true"],
.autocomplete-richlistitem[selected="true"],
.autocomplete-richlistitem:hover,
#richlistbox richlistitem[selected="true"],
#richlistbox richlistitem:hover {
    background-color: ${hexColor} !important;
    color: #ffffff !important;
}`;
}

function killBrowsers() {
  try {
    Gio.Subprocess.new(["killall", "zen", "zen-bin", "firefox"], 0);
  } catch (e) {}
}

async function getProfilePaths(baseDir) {
  const iniPath = GLib.build_filenamev([baseDir, "profiles.ini"]);
  const iniFile = Gio.File.new_for_path(iniPath);
  const iniContent = await loadFile(iniFile);

  if (!iniContent) return [];

  return [...iniContent.matchAll(/^Path=(.+)$/gm)].map((m) => {
    const path = m[1].trim();
    return path.startsWith("/") ? path : GLib.build_filenamev([baseDir, path]);
  });
}

async function handleJsFile(jsFile, isUserJs, hexColor, isReset) {
  const content = await loadFile(jsFile);

  if (!content) {
    if (isUserJs && !isReset) {
      const freshContent = generateTargetLines(hexColor).join("\n") + "\n";
      await saveFile(jsFile, freshContent);
    }
    return;
  }

  const finalContent = updateJsContent(content, hexColor, isReset);

  if (finalContent === "") {
    try {
      jsFile.delete(null);
    } catch (e) {}
  } else {
    await saveFile(jsFile, finalContent + "\n");
  }
}

async function handleChromeCss(profilePath, hexColor, isReset) {
  const userChrome = Gio.File.new_for_path(
    GLib.build_filenamev([profilePath, "chrome", "userChrome.css"]),
  );

  if (isReset) {
    try {
      userChrome.delete(null);
    } catch (e) {}
    return;
  }

  const chromeDir = Gio.File.new_for_path(
    GLib.build_filenamev([profilePath, "chrome"]),
  );
  if (!chromeDir.query_exists(null)) {
    try {
      chromeDir.make_directory_with_parents(null);
    } catch (e) {}
  }

  await saveFile(userChrome, generateUserChromeCss(hexColor));
}

const BASE_DIRS = [
  ".config/mozilla/firefox",
  ".config/zen",
  ".mozilla/firefox",
  ".zen",
  ".var/app/org.mozilla.firefox/.mozilla/firefox",
  ".var/app/org.mozilla.firefox/.config/mozilla/firefox",
  ".var/app/io.zen_browser.zen/.zen",
  ".var/app/io.zen_browser.zen/.config/zen",
].map((p) => GLib.build_filenamev([GLib.get_home_dir(), ...p.split("/")]));

export async function applyFirefoxThemeState(hexColor, isReset = false) {
  if (isReset) {
    killBrowsers();
  }

  for (const base of BASE_DIRS) {
    const profilePaths = await getProfilePaths(base);

    for (const profilePath of profilePaths) {
      const userJs = Gio.File.new_for_path(
        GLib.build_filenamev([profilePath, "user.js"]),
      );
      const prefsJs = Gio.File.new_for_path(
        GLib.build_filenamev([profilePath, "prefs.js"]),
      );

      await handleJsFile(userJs, true, hexColor, isReset);
      await handleJsFile(prefsJs, false, hexColor, isReset);

      await handleChromeCss(profilePath, hexColor, isReset);
    }
  }
}
