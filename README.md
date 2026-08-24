<div align="center">

# ChromaLeon

<img width="250" alt="Gnome Extensions Icon" src="https://github.com/user-attachments/assets/a5c0c8e1-d11f-42c7-9a19-06746e26468b" />

<br><br>

### Adapt GNOME colors like a chameleon
Change your GNOME Shell, Adwaita, adw-gtk3, and app/folder icons accent colors dynamically based on your wallpaper.

---
[![GNOME Extensions Downloads](https://img.shields.io/gnome-extensions/dt/user-accent-colors@fabito02?style=flat&logo=gnome&logoColor=white&color=3f86e3)](https://extensions.gnome.org/extension/10070/user-accent-colors/)
[![GitHub License](https://img.shields.io/github/license/fabito02/ChromaLeon?style=flat&logo=gplv3&logoColor=white&color=50fa7b)](https://github.com/Fabito02/ChromaLeon/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/Fabito02/ChromaLeon?style=flat&logo=github&logoColor=white&color=f1fa8c)](https://github.com/Fabito02/ChromaLeon/stargazers)
[![Translation Status](https://img.shields.io/weblate/progress/chromaleon?style=flat&logo=weblate&logoColor=white)](https://hosted.weblate.org/engage/chromaleon/)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/Fabito02?style=flat&logo=githubsponsors&logoColor=white&color=ea4aaa)](https://github.com/sponsors/Fabito02)

<br>

<img width="2560" height="1440" src="https://github.com/user-attachments/assets/c695c288-5fe6-4dea-b59f-ebd8129702d6" />

<br>
<br>

| Base Style | Dark Mode Example | Light Mode Example |
| :--- | :--- | :--- |
| **Tinted** | <img width="1366" height="768" alt="Tinted Dark" src="https://github.com/user-attachments/assets/ef98ba16-7151-4360-b783-8c302cd66cee" /> | <img width="1366" height="768" alt="Tinted Light" src="https://github.com/user-attachments/assets/98a9cfad-80a1-49c2-b8aa-990860daa3e2" /> |
| **Standard** | <img width="1366" height="768" alt="Standard Dark" src="https://github.com/user-attachments/assets/fda49284-95dd-49b0-a4c4-2099c8cc31f5" /> | <img width="1366" height="768" alt="Standard Light" src="https://github.com/user-attachments/assets/ce4f87fe-6deb-4368-aa8e-a2c4eabd93f1" /> |
| **Folders and Apps** | <img width="1366" height="768" alt="Folders and Icons Dark" src="https://github.com/user-attachments/assets/40289967-4f5a-48ca-8360-97ba85a3c221" /> | <img width="1366" height="768" alt="Folders and Icons Light" src="https://github.com/user-attachments/assets/705b5c0e-6e1d-459f-9862-73ac319a58c5" /> |

<br>
</div>

## Features

* **Dynamic Extraction:** Automatically extracts accent colors from your current wallpaper.
* **GNOME Colors:** Support for native GNOME accent colors.
* **Unified Theme:** Applies accent colors seamlessly across GNOME Shell and `GTK 3.0` / `GTK 4.0` apps.
* **Tint:** Theme the Shell and all your LibAdwaita and GTK3 applications with Adw-GTK3.
* **Accent Colors in Folders:** Applies the accent color to the folders.
* **Accent Colors in Apps:** Applies the accent color to some app icons.
* **Wallpaper selector:** Wallpaper selector for user wallpapers and Gnome dynamic wallpapers.
* **Custom CSS:** Apply custom CSS to the shell, with support for ChromaLeon's accent color.
* **Hot Reload:** Hot reload for GTK4 applications with support for ChromaLeon colors (this works natively for GNOME colors).
* **Flatpak Support:** Syncs color variables so your sandboxed Flatpak applications match the rest of the system.
* **Shortcut:** Create a shortcut in the app grid to use this as an app.

> Note: Special thanks to [PakoVM](https://github.com/pakovm-git) for the code for the tinted style, which was based on his [Tint My GNOME](https://github.com/pakovm-git/Tint-my-Gnome) extension.
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
git clone https://github.com/Fabito02/ChromaLeon

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

### ChromaLeon is a project I maintain in my spare time. If it helps you customize your device, please consider supporting my work with a small contribution :)
<br>

**GitHub Sponsors:**
<br>

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Fabito02)
<br>

**Kofi:**
<br>

[<img height="60" alt="support_me_on_kofi_badge_beige" src="https://github.com/user-attachments/assets/2b1250e5-3e73-43be-b3a9-9e6f7c9dc187" />](https://ko-fi.com/fabito02)

**Pix (For Brazilian users 🇧🇷️):**
<br>

<img width="200" alt="Pix" src="https://github.com/user-attachments/assets/5f04d71e-4b7f-401d-89eb-ba059ce790b6" />
<br><br>

<img width="200" alt="QR Code Pix" src="https://github.com/user-attachments/assets/bff31fed-651c-4751-9783-3d8fa9fa68dd" />
<br><br>

**Pix Key:** `9492f4aa-3da3-4824-ac7f-6f559a9b360d`

## 🌟️ Contributors

<a href="https://github.com/fabito02/chromaleon/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fabito02/chromaleon" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
