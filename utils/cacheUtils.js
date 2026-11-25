/*
 * cacheUtils.js
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
import { writeFile, readFile } from "./fileUtils.js";
import { throwIfCancelled, isCancelledError } from "./cancellation.js";

const colorCacheFile = Gio.File.new_for_path(
  `${GLib.get_user_cache_dir()}/chromaleon/color-cache.json`,
);

// Returns a string that changes whenever the file behind `uri` changes, or
// null if it can't be read. Wallpapers set through the xdg-desktop-portal
// (Nautilus, Flatpak apps such as Damask or Valhalla) are always copied to the
// same path (~/.config/background), so the URI alone can't identify an image.
export function getWallpaperStamp(uri, cancellable = null) {
  return new Promise((resolve, reject) => {
    if (!uri || !uri.startsWith("file://")) {
      resolve(null);
      return;
    }

    Gio.File.new_for_uri(uri).query_info_async(
      "time::modified,time::modified-usec,standard::size",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      cancellable,
      (file, res) => {
        try {
          const info = file.query_info_finish(res);
          const mtime = info.get_attribute_uint64("time::modified");
          const usec = info.get_attribute_uint32("time::modified-usec");
          resolve(`${mtime}.${usec}:${info.get_size()}`);
        } catch (e) {
          if (isCancelledError(e)) reject(e);
          else resolve(null);
        }
      },
    );
  });
}

function isEntryValid(entry, stamp) {
  // Entries without a stamp predate this check and may describe an image that
  // has since been replaced at the same path, so they're treated as stale.
  return Boolean(entry) && (stamp === null || entry.stamp === stamp);
}

// Returns the cached entry for `uri` if it still matches the file on disk,
// together with the file's current stamp (pass it back to
// writeColorCacheFile so the entry is tied to the image that was analysed).
export async function getColorCacheEntry(uri, cancellable = null) {
  throwIfCancelled(cancellable);

  const stamp = await getWallpaperStamp(uri, cancellable);
  const colorCache = await getColorCache(cancellable);
  const entry = colorCache[uri];

  return { entry: isEntryValid(entry, stamp) ? entry : null, stamp };
}

export async function writeColorCacheFile(
  key,
  value,
  cancellable = null,
  stamp = undefined,
) {
  throwIfCancelled(cancellable);

  if (stamp === undefined) stamp = await getWallpaperStamp(key, cancellable);

  const currentCache = await getColorCache(cancellable);
  const previous = currentCache[key];

  currentCache[key] = {
    ...(isEntryValid(previous, stamp) ? previous : {}),
    ...value,
    ...(stamp !== null ? { stamp } : {}),
  };

  await writeFile(colorCacheFile, JSON.stringify(currentCache), cancellable);
  return currentCache;
}

export async function getColorCache(cancellable = null) {
  throwIfCancelled(cancellable);

  try {
    const content = await readFile(colorCacheFile, cancellable);
    if (!content) return {};

    return JSON.parse(content);
  } catch (e) {
    if (isCancelledError(e)) throw e;
    return {};
  }
}
