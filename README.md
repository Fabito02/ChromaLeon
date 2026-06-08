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

| Base Style | Dark Mode Example | Light Mode Example |
| :--- | :--- | :--- |
| **Standard** | <img width="1366" height="768" alt="Standard Dark" src="https://github.com/user-attachments/assets/7321ff87-9164-4508-91e1-7b4eb9464594" /> | <img width="1366" height="768" alt="Standard Light" src="https://github.com/user-attachments/assets/cb17365b-72d0-4946-bcad-5af305f61244" /> |
| **Tinted** | <img width="1366" height="768" alt="Tinted Dark" src="https://github.com/user-attachments/assets/22e9993a-8509-476f-8146-cecb61bcb9a5" /> | <img width="1366" height="768" alt="Tinted Light" src="https://github.com/user-attachments/assets/5fc70122-91b3-42c6-9c90-f9fe334dfe06" /> |
| **Folders and Apps** | <img width="1366" height="768" alt="Folders and Apps Dark" src="https://github.com/user-attachments/assets/92cbd9ed-615c-4677-b927-3515a2e7554a" /> | <img width="1366" height="768" alt="Folders and Apps Light" src="https://github.com/user-attachments/assets/86c1ca57-a606-423a-ac48-ebe375435280" /> |


</div>

## Features

* **Dynamic Extraction:** Automatically extracts accent colors from your current wallpaper.
* **Unified Theme:** Applies accent colors seamlessly across GNOME Shell and local `GTK 3.0` / `GTK 4.0` apps.
* **Flatpak Support:** Syncs color variables so your sandboxed Flatpak applications match the rest of the system.
* **Tint:** Tints all system elements with accent colors.
* **Accent Colors in Folders :** Applies the accent color to the folders.
* **Accent Colors in Apps :** Applies the accent color to some app icons.
* **Shortcut:** Create a shortcut in the app grid to use this as an app.

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
