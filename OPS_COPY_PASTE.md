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

## 8) Build release APK (for testing)

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
