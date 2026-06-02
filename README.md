<div align="center">

# User Accent Colors

Change your GNOME Shell, GTK, and adw-gtk3 accent colors dynamically based on your wallpaper.

---

![GNOME Extensions Downloads](https://img.shields.io/gnome-extensions/dt/user-accent-colors@fabito02?cacheSeconds=60&logo=gnome&logoColor=white&color=3f86e3)
![GitHub License](https://img.shields.io/github/license/fabito02/user-accent-colors?color=50fa7b)
[![Stars](https://img.shields.io/github/stars/Fabito02/user-accent-colors?style=social)](https://github.com/Fabito02/user-accent-colors/stargazers)

<br>

| | |
| :--- | :--- |
| <img width="250" src="https://github.com/user-attachments/assets/ed6a47e0-b6c1-4ad2-888b-2e15a1fce10d" /> | <img width="800" src="https://github.com/user-attachments/assets/66a9b288-2770-4fd1-a358-3da4d14a850a" /> |

</div>

## Features

* **Dynamic Extraction:** Automatically extracts accent colors from your current wallpaper.
* **Unified Theme:** Applies accent colors seamlessly across GNOME Shell and local `GTK 3.0` / `GTK 4.0` apps.
* **Flatpak Support:** Syncs color variables so your sandboxed Flatpak applications match the rest of the system.

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
git clone [https://github.com/Fabito02/user-accent-colors.git](https://github.com/Fabito02/user-accent-colors.git)

# Move it to the extensions directory
mv user-accent-colors ~/.local/share/gnome-shell/extensions/user-accent-colors@fabito02

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
