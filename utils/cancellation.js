/*
 * cancellation.js
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

// GJS is single-threaded, so a running async chain can't be pre-empted; it can
// only notice cancellation at checkpoints. This throws the same error shape a
// cancelled Gio async op produces, so both paths unwind identically.
export function throwIfCancelled(cancellable) {
  if (cancellable && cancellable.is_cancelled()) {
    throw new GLib.Error(
      Gio.IOErrorEnum,
      Gio.IOErrorEnum.CANCELLED,
      "Operation superseded by a newer request",
    );
  }
}

export function isCancelledError(e) {
  return Boolean(e?.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED));
}
