import Gio from "gi://Gio";
import GLib from "gi://GLib";

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

export async function createDesktopFile(path) {
  try {
    const dataDir = GLib.get_user_data_dir();
    const desktopPath = GLib.build_filenamev([
      dataDir,
      "applications",
      "com.github.fabito02.chromaleon.desktop",
    ]);

    const file = Gio.File.new_for_path(desktopPath);
    const iconBaseName = "io.github.Fabito02.chromaleon";
    const hicolorDir = `${GLib.get_home_dir()}/.local/share/icons/hicolor/scalable/apps`;
    const iconSource = `${path}/assets/${iconBaseName}.svg`;

    await runShellAsync(`mkdir -p "${hicolorDir}"`);
    await runShellAsync(
      `cp "${iconSource}" "${hicolorDir}/${iconBaseName}.svg"`,
    );
    await runShellAsync(
      `gtk-update-icon-cache -qf "${GLib.get_home_dir()}/.local/share/icons/hicolor"`,
    );

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

    let bytes = new GLib.Bytes(new TextEncoder().encode(content));

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
  } catch (e) {}
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
  } catch (e) {}
}
