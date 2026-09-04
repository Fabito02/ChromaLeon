/*
 * fileUtils.js
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

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { throwIfCancelled } from "./cancellation.js";

Gio._promisify(
  Gio.File.prototype,
  "replace_contents_bytes_async",
  "replace_contents_finish",
);
Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);

export async function writeFile(file, content, cancellable = null) {
  throwIfCancelled(cancellable);

  const parentDir = file.get_parent();
  if (parentDir && !parentDir.query_exists(null)) {
    parentDir.make_directory_with_parents(null);
  }

  const bytes = GLib.Bytes.new(new TextEncoder().encode(content));

  await file.replace_contents_bytes_async(
    bytes,
    null,
    false,
    Gio.FileCreateFlags.NONE,
    cancellable,
  );
}

export async function readFile(file, cancellable = null) {
  throwIfCancelled(cancellable);

  if (!file.query_exists(null)) {
    return null;
  }

  const [content] = await file.load_contents_async(cancellable);
  return new TextDecoder().decode(content);
}

export async function createDesktopFile(path) {
  const dataDir = GLib.get_user_data_dir();
  const desktopPath = GLib.build_filenamev([
    dataDir,
    "applications",
    "com.github.fabito02.chromaleon.desktop",
  ]);

  const file = Gio.File.new_for_path(desktopPath);

  const appsDir = file.get_parent();
  if (!appsDir.query_exists(null)) {
    appsDir.make_directory_with_parents(null);
  }

  const iconBaseName = "io.github.Fabito02.chromaleon";
  const iconDestPath = GLib.build_filenamev([
    dataDir,
    "icons",
    "hicolor",
    "scalable",
    "apps",
    `${iconBaseName}.svg`,
  ]);
  const iconSourcePath = GLib.build_filenamev([
    path,
    "assets",
    `${iconBaseName}.svg`,
  ]);

  const iconSourceFile = Gio.File.new_for_path(iconSourcePath);
  const iconDestFile = Gio.File.new_for_path(iconDestPath);

  const iconDir = iconDestFile.get_parent();
  if (!iconDir.query_exists(null)) {
    iconDir.make_directory_with_parents(null);
  }

  iconSourceFile.copy(iconDestFile, Gio.FileCopyFlags.OVERWRITE, null, null);

  const content = `[Desktop Entry]
Type=Application
Terminal=false
NoDisplay=false
StartupNotify=true
Categories=Settings;DesktopSettings;GTK;
Name=ChromaLeon
Comment=Adapt the system's colors like a chameleon
Comment[pt_BR]=Adapte as cores do sistema como um camaleão
Comment[es]=Adapta los colores del sistema como un camлеón
Comment[fr]=Adaptez les couleurs du système comme un caméléon
Comment[de]=Passen Sie die Systemfarben wie ein Chamäleon an
Comment[it]=Adatta i colori del sistema come un camaleonte
Comment[ru]=Адаптируйте цвета системы, как хамелеон
Exec=sh -c "cd '${path}' && GSETTINGS_SCHEMA_DIR=./schemas CHROMALEON_LAUNCH=1 gjs -m chromaleon.js"
Icon=${iconBaseName}
StartupWMClass=com.github.fabito02.chromaleon`;

  let bytes = new GLib.Bytes(new TextEncoder().encode(content.trim()));

  await new Promise((resolve, reject) => {
    file.replace_contents_bytes_async(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      (obj, res) => {
        try {
          file.replace_contents_finish(res);
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

export function removeDesktopFile() {
  const dataDir = GLib.get_user_data_dir();
  const desktopPath = GLib.build_filenamev([
    dataDir,
    "applications",
    "com.github.fabito02.chromaleon.desktop",
  ]);
  const file = Gio.File.new_for_path(desktopPath);

  if (file.query_exists(null)) {
    file.delete(null);
  }
}
