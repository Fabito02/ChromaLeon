<div align="center">

# ChromaLeon

<img width="250" alt="Gnome Extensions Icon" src="https://github.com/user-attachments/assets/a5c0c8e1-d11f-42c7-9a19-06746e26468b" />

<br><br>

### Adapt the system's colors like a chameleon
Change your GNOME Shell, Adwaita, adw-gtk3, and app/folder icons accent colors dynamically based on your wallpaper.

---

[![GNOME Extensions Downloads](https://img.shields.io/gnome-extensions/dt/user-accent-colors@fabito02?cacheSeconds=60&logo=gnome&logoColor=white&color=3f86e3)](https://extensions.gnome.org/extension/10070/user-accent-colors/)
[![GitHub License](https://img.shields.io/github/license/fabito02/ChromaLeon?color=50fa7b)](https://github.com/Fabito02/ChromaLeon/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/Fabito02/ChromaLeon?style=social)](https://github.com/Fabito02/ChromaLeon/stargazers)
[![Translation Status](https://hosted.weblate.org/widgets/chromaleon/-/svg-badge.svg)](https://hosted.weblate.org/engage/chromaleon/)

<br>
<img width="2560" height="1440" src="https://github.com/user-attachments/assets/c695c288-5fe6-4dea-b59f-ebd8129702d6" />
<br>

| Base Style | Dark Mode Example | Light Mode Example |
| :--- | :--- | :--- |
| **Tinted** | <img width="1366" height="768" alt="Tinted Dark" src="https://github.com/user-attachments/assets/31e4f807-dede-44db-902d-cde00dcaf407" /> | <img width="1366" height="768" alt="Tinted Light" src="https://github.com/user-attachments/assets/24f2efa1-9a0d-424d-869f-727c8ec95632" /> |
| **Standard** | <img width="1366" height="768" alt="Standard Dark" src="https://github.com/user-attachments/assets/02ad9710-d356-4995-8672-9f03158b82c8" /> | <img width="1366" height="768" alt="Standard Light" src="https://github.com/user-attachments/assets/a627412e-db6a-47b2-9e5f-cf41d9680b19" /> |
| **Folders and Apps** | <img width="1366" height="768" alt="Folders and Icons Dark" src="https://github.com/user-attachments/assets/48e01635-c2c3-46d8-bb3c-5d1cc0dda0c8" /> | <img width="1366" height="768" alt="Folders and Icons Light" src="https://github.com/user-attachments/assets/1f0974aa-0839-436b-83d5-c255ecbc4be2" /> |


</div>

## Features

* **Dynamic Extraction:** Automatically extracts accent colors from your current wallpaper.
* **Unified Theme:** Applies accent colors seamlessly across GNOME Shell and local `GTK 3.0` / `GTK 4.0` apps.
* **Flatpak Support:** Syncs color variables so your sandboxed Flatpak applications match the rest of the system.
* **Tint:** Tints all system elements with accent colors.
* **Accent Colors in Folders :** Applies the accent color to the folders.
* **Accent Colors in Apps :** Applies the accent color to some app icons.
* **Wallpaper selector :** Wallpaper selector for user wallpapers and Gnome dynamic wallpapers.
* **Shortcut:** Create a shortcut in the app grid to use this as an app.

---

## Translation

<div align="center">
  <div>
    <a href="https://hosted.weblate.org/engage/chromaleon/">
      <img src="https://github.com/user-attachments/assets/167726c7-481c-4492-bbb4-1c1346ab7c5a" alt="Weblate Logo" width="100" style="vertical-align: middle; margin-right: 20px;" />
    </a>
    <h3>Help Translate ChromaLeon</h3>
    <p>Contribute to making the project accessible in your language via Weblate!</p>
  </div>
  
  <br />
  
  <a href="https://hosted.weblate.org/engage/chromaleon/">
    <img src="https://hosted.weblate.org/widget/chromaleon/multi-auto.svg" alt="Translation Status" style="vertical-align: middle;" />
  </a>
</div>

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
