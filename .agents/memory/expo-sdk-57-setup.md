---
name: Expo SDK 57 setup
description: Replit-specific Expo dependency resolution and web workflow launch behavior.
---

## Dependency installation

When adding packages, use versions compatible with the installed Expo SDK and inspect both `package.json` and `package-lock.json` afterward. Dependency resolution can select a newer React DOM that conflicts with the project's pinned React version, and npm may rewrite unrelated ranges or registry URLs.

**Why:** A package install failed because a caret range selected React DOM 19.3 alongside React 19.2.3; the install also rewrote unrelated lockfile metadata.

**How to apply:** Prefer SDK-compatible locked package versions, then review the manifest and lockfile diff for unrelated changes before keeping it.

## Replit web workflow

Start the Expo web preview with `BROWSER=none` and port 5000. This prevents Expo from trying to launch a desktop browser in the headless container.

**Why:** Expo's default browser launch called `xdg-open`, which exited unsuccessfully in the container. Disabling browser launch lets Metro continue serving the app; the optional DevTools launcher can still print a missing-GLib error without stopping the preview.

**How to apply:** Keep `BROWSER=none` in the Expo web workflow command and verify the preview through the running workflow rather than the CLI's desktop-launch status.