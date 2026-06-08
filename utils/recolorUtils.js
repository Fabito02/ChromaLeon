import GLib from "gi://GLib";
import Gio from "gi://Gio";

async function runShellAsync(command) {
  return new Promise((resolve) => {
    try {
      let proc = Gio.Subprocess.new(
        ["bash", "-c", command],
        Gio.SubprocessFlags.NONE,
      );
      proc.wait_async(null, (obj, res) => {
        try {
          proc.wait_finish(res);
          resolve(proc.get_successful());
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function modifyColor(hex, lMod, sMod) {
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  if (hex.length !== 6) return null;

  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  l = Math.max(0, Math.min(1, l + lMod));
  s = Math.max(0, Math.min(1, s + sMod));

  let newR, newG, newB;
  if (s === 0) {
    newR = newG = newB = l;
  } else {
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    newR = hue2rgb(p, q, h + 1 / 3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

async function recolorSvgAsync(file, colorMap) {
  return new Promise((resolve) => {
    try {
      if (!file.query_exists(null)) {
        resolve();
        return;
      }

      file.load_contents_async(null, (obj, res) => {
        try {
          let [success, contents] = file.load_contents_finish(res);
          if (!success) {
            resolve();
            return;
          }

          let svgText = new TextDecoder().decode(contents);
          let modified = false;

          for (const [oldHex, newHex] of Object.entries(colorMap)) {
            let regex = new RegExp(`#${oldHex}`, "gi");
            if (regex.test(svgText)) {
              svgText = svgText.replace(regex, `#${newHex}`);
              modified = true;
            }
          }

          if (modified) {
            let bytes = new GLib.Bytes(new TextEncoder().encode(svgText));
            file.replace_contents_bytes_async(
              bytes,
              null,
              false,
              Gio.FileCreateFlags.REPLACE_DESTINATION,
              null,
              (obj2, res2) => {
                try {
                  file.replace_contents_finish(res2);
                } catch (e) {}
                resolve();
              },
            );
          } else {
            resolve();
          }
        } catch (e) {
          resolve();
        }
      });
    } catch (e) {
      resolve();
    }
  });
}

async function processDirectoryAsync(dirPath, colorMap) {
  let dir = Gio.File.new_for_path(dirPath);
  if (!dir.query_exists(null)) return;

  let enumerator = dir.enumerate_children(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    null,
  );

  let filesToProcess = [];
  let info;
  while ((info = enumerator.next_file(null)) !== null) {
    let type = info.get_file_type();
    let name = info.get_name();
    let child = dir.get_child(name);
    filesToProcess.push({ type, child, name });
  }

  for (let item of filesToProcess) {
    if (item.type === Gio.FileType.DIRECTORY) {
      await processDirectoryAsync(item.child.get_path(), colorMap);
    } else if (
      (item.type === Gio.FileType.REGULAR ||
        item.type === Gio.FileType.SYMBOLIC_LINK) &&
      item.name.endsWith(".svg")
    ) {
      await recolorSvgAsync(item.child, colorMap);
    }
  }
}

export async function applyAccentTheme(baseColor, options = {}) {
  const { applyApps = false, useMoreWaita = false } = options;

  if (!baseColor) return "ERR_MISSING_COLOR";

  const darkAccent = modifyColor(baseColor, -0.15, 0.0);
  const medAccent = modifyColor(baseColor, 0.0, 0.0);
  const lightAccent = modifyColor(baseColor, 0.08, 0.0);
  const bgSoft = modifyColor(baseColor, 0.25, 0.12);
  const intenseGlow = modifyColor(baseColor, 0.3, 0.1);
  const bgDiffuse = modifyColor(baseColor, 0.28, -0.2);

  const deepShadow = modifyColor(baseColor, -0.2, -0.05);
  const extremeLight = modifyColor(baseColor, 0.15, 0.05);
  const superLight = modifyColor(baseColor, 0.4, 0.05);

  const colorMap = {
    "3f8ae5": darkAccent,
    "438de6": medAccent,
    "62a0ea": extremeLight,
    a4caee: bgSoft,
    afd4ff: intenseGlow,
    c0d5ea: bgDiffuse,
    "3584e4": medAccent,
    "1a5fb4": darkAccent,
    "1c71d8": modifyColor(baseColor, -0.02, 0.0),
    DEEP_SHADOW: deepShadow,
    EXTREME_LIGHT: extremeLight,
    "99c1f1": modifyColor(baseColor, 0.25, 0.05),
    c3e5e7: extremeLight,
    "14498a": deepShadow,
    "1e77e1": darkAccent,
    "1966c2": deepShadow,
    d7e8fc: modifyColor(baseColor, 0.45, 0.05),
    b3d3f9: modifyColor(baseColor, 0.35, 0.05),
    SUPER_LIGHT: superLight,
    cc9c54: darkAccent,
    d5ae73: lightAccent,
    cc920a: darkAccent,
    ce9508: darkAccent,
    ce9708: darkAccent,
    "98c1f1": modifyColor(baseColor, 0.23, 0.0),
    d3e3f9: modifyColor(baseColor, 0.4, -0.15),
    "4a86cf": medAccent,
  };

  const homeDir = GLib.get_home_dir();
  const targetDir = `${homeDir}/.local/share/icons/Adwaita-Dynamic`;
  const sysAdwaita = "/usr/share/icons/Adwaita";
  let inheritsChain = "Adwaita,AdwaitaLegacy,hicolor";

  if (!GLib.file_test(`${sysAdwaita}/scalable`, GLib.FileTest.IS_DIR)) {
    return "ERR_NO_ADWAITA";
  }

  await runShellAsync(`rm -rf "${targetDir}"`);
  await runShellAsync(
    `mkdir -p "${targetDir}/scalable/places" "${targetDir}/scalable/status" "${targetDir}/scalable/mimetypes"`,
  );
  await runShellAsync(
    `cp -r "${sysAdwaita}/scalable/places/"* "${targetDir}/scalable/places/" 2>/dev/null || true`,
  );
  await runShellAsync(
    `cp -r "${sysAdwaita}/scalable/status/"* "${targetDir}/scalable/status/" 2>/dev/null || true`,
  );
  if (
    GLib.file_test(`${sysAdwaita}/scalable/mimetypes`, GLib.FileTest.IS_DIR)
  ) {
    await runShellAsync(
      `cp -rL "${sysAdwaita}/scalable/mimetypes/"* "${targetDir}/scalable/mimetypes/" 2>/dev/null || true`,
    );
  }

  const hicolorApps = "/usr/share/icons/hicolor/scalable/apps";
  const userHicolorApps = `${homeDir}/.local/share/icons/hicolor/scalable/apps`;

  const appsToRecolor = [
    "org.gnome.Calculator.svg",
    "org.gnome.Calendar.svg",
    "org.gnome.Contacts.svg",
    "org.gnome.Geary.svg",
    "org.gnome.Nautilus.svg",
    "org.gnome.TextEditor.svg",
    "org.gnome.Logs.svg",
    "org.gnome.font-viewer.svg",
    "org.gnome.tweaks.svg",
    "ca.desrt.dconf-editor.svg",
    "com.mattjakeman.ExtensionManager.svg",
    "page.tesk.Refine.svg",
    "io.github.Fabito02.chromaleon.svg",
  ];

  if (applyApps) {
    await runShellAsync(`mkdir -p "${targetDir}/scalable/apps"`);
    for (let app of appsToRecolor) {
      if (GLib.file_test(`${userHicolorApps}/${app}`, GLib.FileTest.EXISTS)) {
        await runShellAsync(
          `cp "${userHicolorApps}/${app}" "${targetDir}/scalable/apps/" 2>/dev/null || true`,
        );
      } else {
        await runShellAsync(
          `cp "${hicolorApps}/${app}" "${targetDir}/scalable/apps/" 2>/dev/null || true`,
        );
      }
    }
  }

  if (useMoreWaita) {
    const possiblePaths = [
      "/usr/share/icons/MoreWaita",
      `${homeDir}/.local/share/icons/MoreWaita`,
      `${homeDir}/.icons/MoreWaita`,
    ];

    let moreWaitaDir = possiblePaths.find((p) =>
      GLib.file_test(`${p}/scalable`, GLib.FileTest.IS_DIR),
    );

    if (moreWaitaDir) {
      inheritsChain = `MoreWaita,${inheritsChain}`;
      await runShellAsync(
        `cp -rL "${moreWaitaDir}/scalable/mimetypes/"* "${targetDir}/scalable/mimetypes/" 2>/dev/null || true`,
      );
      await runShellAsync(
        `cp -r "${moreWaitaDir}/scalable/places/"* "${targetDir}/scalable/places/" 2>/dev/null || true`,
      );

      if (applyApps) {
        await runShellAsync(
          `cp -r "${moreWaitaDir}/scalable/apps/"* "${targetDir}/scalable/apps/" 2>/dev/null || true`,
        );
      }
    } else {
      return "ERR_NO_MOREWAITA";
    }
  }

  const rebelApps = {
    "org.gnome.Calendar.svg": {
      "9141ac": colorMap["438de6"],
      af60ef: colorMap["EXTREME_LIGHT"],
      "874ab4": colorMap["62a0ea"],
      613583: colorMap["3f8ae5"],
      "3b214e": colorMap["DEEP_SHADOW"],
    },
    "org.gnome.Calculator.svg": {
      ff7800: colorMap["438de6"],
      c64600: colorMap["3f8ae5"],
    },
    "org.gnome.Contacts.svg": {
      "3584e4": colorMap["438de6"],
      "2864b0": colorMap["3f8ae5"],
      "1d60b5": colorMap["DEEP_SHADOW"],
    },
    "org.gnome.Geary.svg": {
      f6d32d: colorMap["438de6"],
      f5c211: colorMap["62a0ea"],
      e5a50a: colorMap["3f8ae5"],
      c18b08: colorMap["DEEP_SHADOW"],
      cc920a: colorMap["DEEP_SHADOW"],
      ce9508: colorMap["DEEP_SHADOW"],
      ce9708: colorMap["DEEP_SHADOW"],
    },
    "com.mattjakeman.ExtensionManager.svg": {
      "0055d4": colorMap["438de6"],
      "003380": colorMap["3f8ae5"],
      "55ddff": colorMap["99c1f1"],
      "80b3ff": colorMap["62a0ea"],
      "0066ff": colorMap["3f8ae5"],
    },
    "org.gnome.font-viewer.svg": {
      c061cb: colorMap["438de6"],
      a347ba: colorMap["3f8ae5"],
      "813d9c": colorMap["DEEP_SHADOW"],
    },
    "page.tesk.Refine.svg": {
      "3584e4": colorMap["438de6"],
      "1c71d8": colorMap["3f8ae5"],
      "62a0ea": colorMap["438de6"],
      "99c1f1": colorMap["EXTREME_LIGHT"],
    },
    "io.github.Fabito02.chromaleon.svg": {
      "33e281": colorMap["EXTREME_LIGHT"],
      "2da964": colorMap["438de6"],
      "1c8454": colorMap["DEEP_SHADOW"],
      "8ff0a4": colorMap["99c1f1"],
      e1ff6c: colorMap["SUPER_LIGHT"],
    },
  };

  await processDirectoryAsync(`${targetDir}/scalable/places`, colorMap);
  await processDirectoryAsync(`${targetDir}/scalable/mimetypes`, colorMap);

  if (applyApps) {
    for (let appName of appsToRecolor) {
      let appFile = Gio.File.new_for_path(
        `${targetDir}/scalable/apps/${appName}`,
      );
      if (appFile.query_exists(null)) {
        await recolorSvgAsync(
          appFile,
          rebelApps[appName] ? rebelApps[appName] : colorMap,
        );
      }
    }
  }

  let directories = [
    "scalable/places",
    "scalable/status",
    "scalable/mimetypes",
  ];
  if (applyApps) directories.push("scalable/apps");

  let indexContent = `[Icon Theme]
Name=Adwaita-Dynamic
Comment=Dynamic Accent Icon Theme for GNOME
Inherits=${inheritsChain}
Hidden=true

Directories=${directories.join(",")}

[scalable/places]
Context=Places
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/status]
Context=Status
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/mimetypes]
Context=MimeTypes
Size=128
MinSize=8
MaxSize=512
Type=Scalable
`;

  if (applyApps) {
    indexContent += `\n[scalable/apps]\nContext=Applications\nSize=128\nMinSize=8\nMaxSize=512\nType=Scalable\n`;
  }

  await new Promise((resolve) => {
    let indexFile = Gio.File.new_for_path(`${targetDir}/index.theme`);
    let bytes = new GLib.Bytes(new TextEncoder().encode(indexContent));
    indexFile.replace_contents_bytes_async(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      (obj, res) => {
        try {
          indexFile.replace_contents_finish(res);
        } catch (e) {}
        resolve();
      },
    );
  });

  await runShellAsync(`gtk-update-icon-cache -qf "${targetDir}"`);

  await new Promise((resolve) => {
    const settings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    if (settings.get_string("icon-theme") === "Adwaita-Dynamic") {
      settings.set_string("icon-theme", "Adwaita");

      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
        settings.set_string("icon-theme", "Adwaita-Dynamic");
        resolve();
        return GLib.SOURCE_REMOVE;
      });
    } else {
      settings.set_string("icon-theme", "Adwaita-Dynamic");
      resolve();
    }
  });

  return "SUCCESS";
}
