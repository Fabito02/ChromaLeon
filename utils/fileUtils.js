import Gio from "gi://Gio";
import GLib from "gi://GLib";

export function createDesktopFile(path) {
  try {
    const dataDir = GLib.get_user_data_dir();

    const desktopPath = GLib.build_filenamev([
      dataDir,
      "applications",
      "com.github.fabito02.chromaleon.desktop",
    ]);

    const file = Gio.File.new_for_path(desktopPath);
    const iconPath = `${path}/assets/io.github.Fabito02.chromaleon.svg`;

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
    Icon=${iconPath}
    StartupWMClass=com.github.fabito02.chromaleon`;

    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);

    file.replace_contents(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  } catch (e) {
    console.error(e);
  }
}

export function removeDesktopFile() {
  const dataDir = GLib.get_user_data_dir();

  const desktopPath = GLib.build_filenamev([
    dataDir,
    "applications",
    "com.github.fabito02.chromaleon.desktop",
  ]);
  const file = Gio.File.new_for_path(desktopPath);

  try {
    if (file.query_exists(null)) {
      file.delete(null);
    }
  } catch (e) {
    console.error(e);
  }
}
