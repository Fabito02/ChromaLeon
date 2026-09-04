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

export async function writeColorCacheFile(key, value, cancellable = null) {
  throwIfCancelled(cancellable);

  const currentCache = await getColorCache(cancellable);
  currentCache[key] = {
    ...(currentCache[key] || {}),
    ...value,
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
