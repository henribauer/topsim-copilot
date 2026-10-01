#!/bin/sh
# Builds "TOPSIM Copilot.app" on the Desktop (AppleScript applet, same as Pressespiegel.app)
# from scripts/launcher.applescript, with the icon from scripts/make-icon.py.
set -eu
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/Desktop/TOPSIM Copilot.app"
python3 "$PROJ/scripts/make-icon.py"
rm -rf "$APP"
osacompile -o "$APP" "$PROJ/scripts/launcher.applescript"
cp "$PROJ/assets/icon.icns" "$APP/Contents/Resources/applet.icns"
rm -f "$APP/Contents/Resources/Assets.car"   # else macOS shows the default script icon
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier de.henribauer.topsim-copilot" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string de.henribauer.topsim-copilot" "$APP/Contents/Info.plist"
# Re-sign last: editing Info.plist/icon breaks osacompile's signature, and macOS then silently
# denies the applet access to the iCloud folder ("Operation not permitted").
codesign --force --deep -s - "$APP"
codesign -v "$APP"
touch "$APP"
echo "built: $APP"
