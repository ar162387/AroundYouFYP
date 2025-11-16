# Fix DEVELOPER_ERROR for Google Sign-In

## Simple Solution

**You don't need to create a separate Android OAuth client!** Just add your SHA-1 fingerprint to your existing **Web application client** (the one you use for Supabase).

## Your Debug SHA-1 Fingerprint
```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

## Steps to Fix

### 1. Go to Google Cloud Console
1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**

### 2. Edit Your Web Application Client

1. Find your **Web application** OAuth client (the one you use for Supabase)
2. Click on it to edit
3. Look for **"Application restrictions"** or **"Android restrictions"** section
4. Add your SHA-1 fingerprint:
   - **SHA-1 certificate fingerprint:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - **Package name:** `com.aroundyou.app`
5. Click **Save**

### 3. Use Your Existing Web Client ID

**Keep using the same Web Client ID** in your `.env` file (the one for Supabase):
```env
GOOGLE_WEB_CLIENT_ID=485522985555-m3ojqjmbv0b03n4bc6qojb4aa0cjm0lj.apps.googleusercontent.com
```

**No need to change this!** Just add the SHA-1 to the existing client.

### 4. Rebuild and Test

1. **Rebuild the app** (React Native Config requires rebuild):
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm start -- --reset-cache
   # In a new terminal:
   npm run android
   ```

2. **Uninstall and reinstall** the app:
   ```bash
   adb uninstall com.aroundyou.app
   npm run android
   ```

3. **Wait 5-10 minutes** for Google's servers to propagate changes

4. Try Google Sign-In again

## Summary

- ✅ Use your **existing Web application client** (for Supabase)
- ✅ Add SHA-1 fingerprint to that client: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- ✅ Add package name: `com.aroundyou.app`
- ✅ Keep using the same Client ID in `.env`
- ✅ Rebuild the app
- ✅ Wait 5-10 minutes

That's it! No need to create a separate Android OAuth client.
