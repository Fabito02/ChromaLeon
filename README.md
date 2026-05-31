# User Accent Colors

Change your GNOME Shell and GTK accent colors dynamically based on your wallpaper.

---

<img width="1366" height="768" alt="Captura de tela de 2026-05-31 06-41-42" src="https://github.com/user-attachments/assets/66a9b288-2770-4fd1-a358-3da4d14a850a" />


### Manual Installation

```bash
git clone https://github.com/Fabito02/user-accent-colors.git
mv user-accent-colors ~/.local/share/gnome-shell/extensions/user-accent-colors@fabito02
glib-compile-schemas ~/.local/share/gnome-shell/extensions/user-accent-colors@fabito02/schemas/
gnome-extensions enable user-accent-colors@fabito02
```

> Note: After enabling, restart GNOME Shell to apply changes (on X11, press `Alt+F2`, type `r`, and hit `Enter`. On Wayland, log out and log back in).
