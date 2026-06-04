<div align="center">

# ChromaLeon

<img width="250" alt="Gnome Extensions Icon" src="https://github.com/user-attachments/assets/a5c0c8e1-d11f-42c7-9a19-06746e26468b" />

<br><br>

### Adapt the system's colors like a chameleon
Change your GNOME Shell, Adwaita, and adw-gtk3 accent colors dynamically based on your wallpaper.

---

![GNOME Extensions Downloads](https://img.shields.io/gnome-extensions/dt/user-accent-colors@fabito02?cacheSeconds=60&logo=gnome&logoColor=white&color=3f86e3)
![GitHub License](https://img.shields.io/github/license/fabito02/ChromaLeon?color=50fa7b)
[![Stars](https://img.shields.io/github/stars/Fabito02/ChromaLeon?style=social)](https://github.com/Fabito02/ChromaLeon/stargazers)

<br>

| **Dark** | <img width="1366" height="768" alt="Captura de tela de 2026-06-03 22-07-52" src="https://github.com/user-attachments/assets/24cb2727-ea1a-4ee1-874d-61a9a4a89de5" /> |
| :--- | :--- |
| **Light** | <img width="1366" height="768" alt="Captura de tela de 2026-06-03 22-08-05" src="https://github.com/user-attachments/assets/a98faeaf-ea8f-4184-9b19-a3623c099368" /> |
| **Tinted Dark** | <img width="1366" height="768" alt="Captura de tela de 2026-06-03 22-07-06" src="https://github.com/user-attachments/assets/b6359185-9cd3-470c-9c92-7a1f0ef855d0" /> |
| **Tinted Light** | <img width="1366" height="768" alt="Captura de tela de 2026-06-03 22-07-19" src="https://github.com/user-attachments/assets/cbca3758-0050-4edd-ae03-a62df74eca26" /> |

</div>

## Features

* **Dynamic Extraction:** Automatically extracts accent colors from your current wallpaper.
* **Unified Theme:** Applies accent colors seamlessly across GNOME Shell and local `GTK 3.0` / `GTK 4.0` apps.
* **Flatpak Support:** Syncs color variables so your sandboxed Flatpak applications match the rest of the system.
* **Tint:** Tints all system elements with accent colors.
* **Shortcut** Create a shortcut in the app grid to use this as an app.

---

## Installation

### The Easy Way

Install it directly from the official GNOME Extensions store with a single click:

<div align="center">

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="75">](https://extensions.gnome.org/extension/10070/user-accent-colors/)

</div>

### Manual Installation

If you prefer to install it manually from source, run the following commands in your terminal:

```bash
# Clone the repository
git clone [https://github.com/Fabito02/user-accent-colors.git](https://github.com/Fabito02/ChromaLeon.git)

# Move it to the extensions directory
mv ChromaLeon ~/.local/share/gnome-shell/extensions/user-accent-colors@fabito02

# Compile the GSettings schemas
glib-compile-schemas ~/.local/share/gnome-shell/extensions/user-accent-colors@fabito02/schemas/

# Enable the extension
gnome-extensions enable user-accent-colors@fabito02

```

> **Note:** After enabling the extension for the first time, you need to restart the GNOME Shell to apply the core stylesheets.
> * **On X11:** Press `Alt + F2`, type `r`, and hit `Enter`.
> * **On Wayland:** Log out and log back into your session.

---

## 💛 Support the Project

If this extension improved your desktop experience, consider supporting my development. Your support keeps projects like this one going!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-white.png" alt="Buy Me A Coffee" height="60">](https://www.buymeacoffee.com/fabito02)
[<img height="60" alt="support_me_on_kofi_badge_beige" src="https://github.com/user-attachments/assets/2b1250e5-3e73-43be-b3a9-9e6f7c9dc187" />](https://ko-fi.com/fabito02)
