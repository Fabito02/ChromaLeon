/*
 * recolorUtils.js
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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { throwIfCancelled } from "./cancellation.js";

let timeoutId = null;

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

async function recolorSvgAsync(file, colorMap, cancellable) {
  return new Promise((resolve) => {
    try {
      if (!file.query_exists(null)) {
        resolve();
        return;
      }

      file.load_contents_async(cancellable, (obj, res) => {
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
            let encoded = new TextEncoder().encode(svgText);
            file.replace_contents_async(
              encoded,
              null,
              false,
              Gio.FileCreateFlags.REPLACE_DESTINATION,
              cancellable,
              (obj2, res2) => {
                try {
                  obj2.replace_contents_finish(res2);
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

async function processDirectoryAsync(dirPath, colorMap, cancellable) {
  let dir = Gio.File.new_for_path(dirPath);
  if (!dir.query_exists(null)) return;

  let enumerator = dir.enumerate_children(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NONE,
    cancellable,
  );

  let filesToProcess = [];
  let info;
  while ((info = enumerator.next_file(null)) !== null) {
    let type = info.get_file_type();
    let name = info.get_name();
    let child = dir.get_child(name);
    filesToProcess.push({ type, child, name });
  }

  const chunkSize = 100;
  for (let i = 0; i < filesToProcess.length; i += chunkSize) {
    throwIfCancelled(cancellable);

    const chunk = filesToProcess.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (item) => {
        if (item.type === Gio.FileType.DIRECTORY) {
          await processDirectoryAsync(
            item.child.get_path(),
            colorMap,
            cancellable,
          );
        } else if (
          (item.type === Gio.FileType.REGULAR ||
            item.type === Gio.FileType.SYMBOLIC_LINK) &&
          item.name.endsWith(".svg")
        ) {
          await recolorSvgAsync(item.child, colorMap, cancellable);
        }
      }),
    );
  }
}

async function deleteRecursiveAsync(file, cancellable) {
  throwIfCancelled(cancellable);

  if (!file.query_exists(null)) return;

  try {
    const info = await new Promise((res, rej) => {
      file.query_info_async(
        "standard::type",
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        GLib.PRIORITY_DEFAULT,
        cancellable,
        (obj, r) => {
          try {
            res(obj.query_info_finish(r));
          } catch (e) {
            rej(e);
          }
        },
      );
    });

    if (info.get_file_type() === Gio.FileType.DIRECTORY) {
      const iter = await new Promise((res, rej) => {
        file.enumerate_children_async(
          "standard::name",
          Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
          GLib.PRIORITY_DEFAULT,
          cancellable,
          (obj, r) => {
            try {
              res(obj.enumerate_children_finish(r));
            } catch (e) {
              rej(e);
            }
          },
        );
      });

      if (iter) {
        while (true) {
          throwIfCancelled(cancellable);

          const infos = await new Promise((res) => {
            iter.next_files_async(
              50,
              GLib.PRIORITY_DEFAULT,
              cancellable,
              (obj, r) => {
                try {
                  res(obj.next_files_finish(r));
                } catch (e) {
                  res([]);
                }
              },
            );
          });

          if (!infos || infos.length === 0) break;

          const branches = infos.map((childInfo) => {
            const child = iter.get_child(childInfo);
            return deleteRecursiveAsync(child, cancellable);
          });

          await Promise.all(branches);
        }

        try {
          iter.close(null);
        } catch (e) {}
      }
    }

    await new Promise((res) => {
      file.delete_async(GLib.PRIORITY_DEFAULT, cancellable, (obj, r) => {
        try {
          obj.delete_finish(r);
        } catch (e) {}
        res();
      });
    });
  } catch (e) {}
}

export async function applyAccentTheme(baseColor, options = {}, cancellable) {
  throwIfCancelled(cancellable);

  const { applyApps = false, useMoreWaita = false } = options;

  const darkAccent = modifyColor(baseColor, -0.08, 0.0);
  const moreDarkAccent = modifyColor(baseColor, -0.12, 0.0);
  const medAccent = modifyColor(baseColor, 0.0, 0.0);
  const lightAccent = modifyColor(baseColor, 0.08, 0.0);
  const bgSoft = modifyColor(baseColor, 0.25, 0.12);
  const intenseGlow = modifyColor(baseColor, 0.3, 0.1);
  const bgDiffuse = modifyColor(baseColor, 0.28, -0.2);

  const deepShadow = modifyColor(baseColor, -0.16, -0.05);
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
    MORE_DARK: moreDarkAccent,
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
  const targetDirFile = Gio.File.new_for_path(targetDir);
  const sysAdwaita = "/usr/share/icons/Adwaita";
  let inheritsChain = "Adwaita,AdwaitaLegacy,hicolor";

  if (!GLib.file_test(`${sysAdwaita}/scalable`, GLib.FileTest.IS_DIR)) {
    throw new Error(_("Adwaita icon pack was not found."));
  }

  throwIfCancelled(cancellable);

  if (targetDirFile.query_exists(null)) {
    await deleteRecursiveAsync(targetDirFile, cancellable);
  }

  throwIfCancelled(cancellable);

  try {
    if (!targetDirFile.query_exists(null)) {
      targetDirFile.make_directory_with_parents(null);
    }
  } catch (e) {}

  async function copyFolderContentAsync(srcPath, destPath) {
    const srcFile = Gio.File.new_for_path(srcPath);
    const destFile = Gio.File.new_for_path(destPath);

    if (!srcFile.query_exists(null)) return;

    if (!destFile.query_exists(null)) {
      try {
        destFile.make_directory_with_parents(null);
      } catch (e) {}
    }

    try {
      const enumerator = await new Promise((res) => {
        srcFile.enumerate_children_async(
          "standard::name,standard::type",
          Gio.FileQueryInfoFlags.NONE,
          GLib.PRIORITY_DEFAULT,
          cancellable,
          (obj, r) => {
            try {
              res(obj.enumerate_children_finish(r));
            } catch (e) {
              res(null);
            }
          },
        );
      });

      if (!enumerator) return;

      while (true) {
        throwIfCancelled(cancellable);

        const infos = await new Promise((res) => {
          enumerator.next_files_async(
            100,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            (obj, r) => {
              try {
                res(obj.next_files_finish(r));
              } catch (e) {
                res([]);
              }
            },
          );
        });

        if (!infos || infos.length === 0) break;

        const copyPromises = infos.forEach(async (info) => {
          const childName = info.get_name();
          const childSrc = srcFile.get_child(childName);
          const childDest = destFile.get_child(childName);

          if (info.get_file_type() === Gio.FileType.DIRECTORY) {
            await copyFolderContentAsync(
              childSrc.get_path(),
              childDest.get_path(),
            );
          } else {
            await new Promise((res) => {
              childSrc.copy_async(
                childDest,
                Gio.FileCopyFlags.OVERWRITE,
                GLib.PRIORITY_DEFAULT,
                cancellable,
                null,
                (obj, r) => {
                  try {
                    obj.copy_finish(r);
                  } catch (e) {}
                  res();
                },
              );
            });
          }
        });

        await Promise.all(copyPromises);
      }
      enumerator.close(null);
    } catch (err) {}
  }

  await copyFolderContentAsync(
    `${sysAdwaita}/scalable/places`,
    `${targetDir}/scalable/places`,
  );
  throwIfCancelled(cancellable);
  await copyFolderContentAsync(
    `${sysAdwaita}/scalable/status`,
    `${targetDir}/scalable/status`,
  );
  throwIfCancelled(cancellable);
  await copyFolderContentAsync(
    `${sysAdwaita}/scalable/mimetypes`,
    `${targetDir}/scalable/mimetypes`,
  );

  const hicolorApps = "/usr/share/icons/hicolor/scalable/apps";
  const userHicolorApps = `${homeDir}/.local/share/icons/hicolor/scalable/apps`;
  const flatpakSysApps =
    "/var/lib/flatpak/exports/share/icons/hicolor/scalable/apps";
  const flatpakUserApps = `${homeDir}/.local/share/flatpak/exports/share/icons/hicolor/scalable/apps`;

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
    throwIfCancelled(cancellable);

    const appsDestDir = Gio.File.new_for_path(`${targetDir}/scalable/apps`);

    if (!appsDestDir.query_exists(null)) {
      try {
        appsDestDir.make_directory_with_parents(null);
      } catch (e) {}
    }

    for (let app of appsToRecolor) {
      throwIfCancelled(cancellable);

      const userAppFile = Gio.File.new_for_path(`${userHicolorApps}/${app}`);
      const sysAppFile = Gio.File.new_for_path(`${hicolorApps}/${app}`);
      const flatpakSysFile = Gio.File.new_for_path(`${flatpakSysApps}/${app}`);
      const flatpakUserFile = Gio.File.new_for_path(
        `${flatpakUserApps}/${app}`,
      );
      const destFile = appsDestDir.get_child(app);

      let sourceFile = null;

      if (userAppFile.query_exists(null)) {
        sourceFile = userAppFile;
      } else if (sysAppFile.query_exists(null)) {
        sourceFile = sysAppFile;
      } else if (flatpakUserFile.query_exists(null)) {
        sourceFile = flatpakUserFile;
      } else if (flatpakSysFile.query_exists(null)) {
        sourceFile = flatpakSysFile;
      }

      if (sourceFile) {
        await new Promise((res) => {
          sourceFile.copy_async(
            destFile,
            Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            null,
            (obj, r) => {
              try {
                obj.copy_finish(r);
              } catch (e) {}
              res();
            },
          );
        });
      }
    }
  }

  if (useMoreWaita) {
    throwIfCancelled(cancellable);

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

      await copyFolderContentAsync(
        `${moreWaitaDir}/scalable/mimetypes`,
        `${targetDir}/scalable/mimetypes`,
      );
      await copyFolderContentAsync(
        `${moreWaitaDir}/scalable/places`,
        `${targetDir}/scalable/places`,
      );
    } else {
      throw new Error(_("MoreWaita icon pack was not found."));
    }
  }

  throwIfCancelled(cancellable);

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
      e5a50a: colorMap["1a5fb4"],
      c18b08: colorMap["DEEP_SHADOW"],
      cc920a: colorMap["MORE_DARK"],
      ce9508: colorMap["1a5fb4"],
      ce9708: colorMap["1a5fb4"],
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
      "2c604e": colorMap["DEEP_SHADOW"],
    },
  };

  await processDirectoryAsync(
    `${targetDir}/scalable/places`,
    colorMap,
    cancellable,
  );
  await processDirectoryAsync(
    `${targetDir}/scalable/mimetypes`,
    colorMap,
    cancellable,
  );
  await processDirectoryAsync(
    `${targetDir}/scalable/status`,
    colorMap,
    cancellable,
  );

  if (applyApps) {
    for (let appName of appsToRecolor) {
      throwIfCancelled(cancellable);

      let appFile = Gio.File.new_for_path(
        `${targetDir}/scalable/apps/${appName}`,
      );
      if (appFile.query_exists(null)) {
        await recolorSvgAsync(
          appFile,
          rebelApps[appName] ? rebelApps[appName] : colorMap,
          cancellable,
        );
      }
    }
  }

  throwIfCancelled(cancellable);

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
    let encodedIndex = new TextEncoder().encode(indexContent);
    indexFile.replace_contents_async(
      encodedIndex,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      cancellable,
      (obj, res) => {
        try {
          obj.replace_contents_finish(res);
        } catch (e) {}
        resolve();
      },
    );
  });

  throwIfCancelled(cancellable);

  await new Promise((resolve) => {
    const settings = Gio.Settings.new("org.gnome.desktop.interface");

    if (timeoutId !== null) {
      GLib.source_remove(timeoutId);
      timeoutId = null;
    }

    if (settings.get_string("icon-theme") === "Adwaita-Dynamic") {
      settings.set_string("icon-theme", "Adwaita");

      timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
        settings.set_string("icon-theme", "Adwaita-Dynamic");
        timeoutId = null;
        resolve();
        return GLib.SOURCE_REMOVE;
      });
    } else {
      settings.set_string("icon-theme", "Adwaita-Dynamic");
      resolve();
    }
  });

  return;
}

export function clearRecolorTimeout() {
  if (timeoutId !== null) {
    GLib.source_remove(timeoutId);
    timeoutId = null;
  }
}
