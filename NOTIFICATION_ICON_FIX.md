# Notification Icon Fix

## Problem
The app logo was not visible in push notifications on Android devices.

## Solution
Added `smallIcon: 'ic_launcher'` to all notification configurations.

## Changes Made

### 1. `src/services/notificationService.ts`
Added `smallIcon: 'ic_launcher'` to foreground notification display.

### 2. `src/services/persistentOrderNotificationService.ts`
Added `smallIcon: 'ic_launcher'` to persistent notification display.

## How It Works

- **Android**: Requires a `smallIcon` property for notifications
- **Notifee**: Uses `'ic_launcher'` to reference the app's launcher icon
- **Icon Location**: Uses the icon defined in `AndroidManifest.xml` (`@mipmap/ic_launcher`)

## Important Notes

### Android Notification Icons

For best results on Android, notification icons should be:
- **Monochrome** (white/transparent) - Android 5.0+ applies a monochromatic mask
- **Simple design** - Silhouette or outline works best
- **Transparent background** - Avoid colored backgrounds

### Current Implementation

Currently using the app launcher icon (`ic_launcher`). This will work, but:
- ✅ Icon will be visible
- ⚠️ May not look optimal if icon has colors/background
- ⚠️ Android will apply a monochrome mask

### Future Improvement

For better visual results, create a dedicated notification icon:

1. **Create monochrome icon** (white, transparent background)
2. **Save as** `ic_notification.png` in `drawable` folders
3. **Update notification config** to use `smallIcon: 'ic_notification'`

Example structure:
```
android/app/src/main/res/
  drawable-mdpi/ic_notification.png
  drawable-hdpi/ic_notification.png
  drawable-xhdpi/ic_notification.png
  drawable-xxhdpi/ic_notification.png
  drawable-xxxhdpi/ic_notification.png
```

## Testing

After rebuild, notifications should now show:
- ✅ App icon in notification panel
- ✅ Icon in status bar
- ✅ Icon next to notification text

## Next Steps

1. **Rebuild the app**: `npm run android`
2. **Test notifications**: Place an order and check notification panel
3. **Optional**: Create a dedicated monochrome notification icon for better appearance

