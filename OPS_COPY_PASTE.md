# AroundYou Ops Copy-Paste Guide

Use this file as your quick command playbook.

## 1) SSH to VPS

```bash
cd /Users/syedshahabdurrehman/Code/ay
chmod 600 ./aroundyou-ssh-oracle-priv.key
ssh -i ./aroundyou-ssh-oracle-priv.key ubuntu@193.123.68.165
```

## 2) Check backend health

```bash
curl -sS http://193.123.68.165/health/live
curl -sS http://193.123.68.165/health/ready
```

## 3) Merchant verification web page

Open:

```text
http://193.123.68.165/merchant-verifications.html
```

In page fields:
- API base URL: `https://193.123.68.165`
- Admin JWT bearer token: paste token from login command below

## 4) Login as admin (get JWT token)

```bash
curl -sS -X POST "http://193.123.68.165/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aroundyou.com","password":"Karachi123"}'
```

Copy `accessToken` value and paste in merchant verification page.

## 5) Promote a user to admin role (if needed)

```bash
ssh -i ./aroundyou-ssh-oracle-priv.key ubuntu@193.123.68.165 "sudo -u postgres psql -d ay_db <<'SQL'
UPDATE user_profiles
SET \"Role\"='admin', \"UpdatedAt\"=NOW() AT TIME ZONE 'utc'
WHERE \"Email\"='admin@aroundyou.com';
SELECT \"Email\", \"Role\" FROM user_profiles WHERE \"Email\"='admin@aroundyou.com';
SQL"
```

## 6) Trigger backend CI/CD deploy (GitHub Actions)

```bash
cd /Users/syedshahabdurrehman/Code/ay
git push origin main
gh workflow run backend-deploy.yml
gh run list --workflow backend-deploy.yml --limit 1
```

## 7) Android debug run (with Metro)

Terminal 1:

```bash
cd /Users/syedshahabdurrehman/Code/ay
npx react-native start --reset-cache --port 8081
```

Terminal 2:

```bash
cd /Users/syedshahabdurrehman/Code/ay
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
npm run android
```

If red screen appears:

```bash
adb shell am force-stop com.aroundyou.app
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
npm run android
```

## 8) Build APKs (debug + release)

Debug APK:

```bash
cd /Users/syedshahabdurrehman/Code/ay
./android/gradlew -p ./android :app:assembleDebug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release APK:

```bash
cd /Users/syedshahabdurrehman/Code/ay
./android/gradlew -p ./android :app:assembleRelease
```

Output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 9) Build release AAB (for Play Console upload)

```bash
cd /Users/syedshahabdurrehman/Code/ay
./android/gradlew -p ./android :app:bundleRelease
```

Output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## 10) Sync VPS self-signed cert to Android app

Run this whenever certificate changes on VPS:

```bash
cd /Users/syedshahabdurrehman/Code/ay
./scripts/sync-vps-cert.sh ubuntu@193.123.68.165 ./aroundyou-ssh-oracle-priv.key
```

Then rebuild app:

```bash
./android/gradlew -p ./android :app:assembleDebug
```

## 11) Current env wiring

- Debug build reads: `.env`
- Release build reads: `.env.production`
- Both should use:

```text
BACKEND_API_URL=https://193.123.68.165
```

## 12) Useful quick checks on VPS

```bash
ssh -i ./aroundyou-ssh-oracle-priv.key ubuntu@193.123.68.165 "sudo systemctl is-active ay-backend nginx postgresql"
ssh -i ./aroundyou-ssh-oracle-priv.key ubuntu@193.123.68.165 "sudo ss -ltn | awk 'NR==1 || /:80|:443|:5017|:5432/'"
ssh -i ./aroundyou-ssh-oracle-priv.key ubuntu@193.123.68.165 "sudo journalctl -u ay-backend -n 80 --no-pager"
```

## 13) Cloudinary (required for merchant shop + item images)

The API **requires** `CLOUDINARY_URL` (or `Cloudinary:Url` / `Cloudinary__Url`) at startup — copy the `cloudinary://…` value from the Cloudinary dashboard.

**Local:** in gitignored `backend/appsettings.Development.json`, set `Cloudinary:Url`, or export `CLOUDINARY_URL` before `dotnet run`.

**Production (VPS):** a systemd drop-in installs the variable (see deploy notes). To set or replace it manually:

```bash
ssh -i ./ssh-key.key ubuntu@193.123.68.165
sudo mkdir -p /etc/systemd/system/ay-backend.service.d
sudo nano /etc/systemd/system/ay-backend.service.d/50-cloudinary.conf
```

Use (paste your real URL from the Cloudinary console; do not commit secrets to git):

```ini
[Service]
Environment="CLOUDINARY_URL=cloudinary://YOUR_API_KEY:YOUR_API_SECRET@YOUR_CLOUD_NAME"
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ay-backend
sudo systemctl is-active ay-backend
```

Legacy DB rows may still reference `/uploads/...`; static files under `wwwroot` can continue to serve those until replaced. New uploads use Cloudinary only.

## 14) Backend version check

```bash
curl -sS http://193.123.68.165/health/version
```