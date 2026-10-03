# Kitchy's: project notes

Read this first when picking up the project in a new session. It records where everything lives and what is still open. (No secrets belong in this file.)

## Where things are

| What | Where |
|---|---|
| Code | GitHub `kitchysegypt-gg/Kitchys`, branch `claude/kitchys-chef-ordering-app-nqzbtr` (pull request #1) |
| Live website (real database) | https://kitchys.expo.app (Expo Hosting, Expo account `kitchyss-teamg`, project id in `app.json` → `extra.eas.projectId`) |
| Database, auth, storage, edge functions | Supabase project `qbyzamcxlxarslfeglfl` |
| Owner email (chef applications) | kitchysegypt@gmail.com |
| Demo link (data stays in each browser, no real database) | https://claude.ai/artifact/CgPPhizJK7mX9A7jYKJCc6 |

## Stack

Expo SDK 57 + Expo Router (routes in `app/`), React Native, TypeScript, npm. Supabase for auth (email + password), Postgres with row level security, Storage (`kitchen-photos` bucket) and edge functions (`kitchy-chat`, `chef-applications`). Font: Plus Jakarta Sans. Icons: Ionicons + MaterialCommunityIcons (tab bar).

Prices, delivery fees, discounts, points, referral cashback and credit are all calculated by database triggers (see `supabase/migrations/`), never trusted from the app.

## Features

Dinner-only menu from home chefs; one chef per order, and customers only see chefs within 15 km of their delivery address (chef locations are private: `chef_locations` table, `chefs_near()` RPC, checked again on every order by the `orders_check_chef` trigger; radius in `delivery_radius_km()` and `DELIVERY_RADIUS_KM` in `lib/catalog.tsx`); dish photos and sizes; cart with scheduling, vouchers, referral code and credit; orders and chef reviews; points, ranks and rewards; refer a friend (10% of the friend's first order as credit, no cap); Kitchy AI chat (Claude); smart notifications (see below); apply as a chef (photos, dishes) → email to the owner with Approve / Reject links → approved chefs manage dishes and photos in My kitchen; languages (English, Arabic, French), themes and accent colours.

## Smart notifications

App saves the phone's push token (`push_devices`) and the cart (`saved_carts`) → every hour (pg_cron job `smart-notifications`, minute 7) Supabase calls the `smart-notifications` edge function → `notification_candidates()` picks who is due → Claude writes a short personal message in their language (built-in messages if `ANTHROPIC_API_KEY` is missing) → sent through Expo push → logged in `notification_log`.

- "Your cart is calling": cart left 2+ hours (up to 3 days) without ordering; opens the cart.
- "We miss you": no order for 7+ days, at most once a week; opens Home.
- Max one notification per person per 20 hours, only 12:00-22:00 Cairo time. Customers can turn them off in Settings.
- Test without sending: POST to the function with header `x-cron-secret` (Vault secret `notifications_cron_secret`) and body `{"dryRun": true}`.
- **Android push needs Firebase** (one-time): create a Firebase project with package `com.kitchys.app`, put `google-services.json` in the project root and set `android.googleServicesFile` in `app.json`, upload the FCM V1 service account key in expo.dev → project → Credentials, then build a new APK. Until then the app schedules the same two reminders on the phone itself.

## Home banners (no app update needed)

1. Supabase → Storage → `promo-banners` → upload the picture (16:9, e.g. 1600 x 900, JPG/PNG under 5 MB) → copy its public URL.
2. Supabase → Table editor → `promo_banners` → Insert row: `image` = that URL, `title` = short name, `link` = none / chefs / rewards / refer / orders / cart / chat, `sort` = position (lower first; current ones are 10, 20, 30), `show_when` = always (or free_delivery to show only to customers with free deliveries left).
3. It appears in the app the next time the home screen opens. Untick `active` to hide a banner.

## Secrets and settings (values are NOT stored in the repo)

- Resend API key (chef application emails): stored in Supabase Vault as `resend_api_key`; the edge function reads it through `public.app_secret()`.
- `ANTHROPIC_API_KEY` for Kitchy AI: **not set yet**. Add it in Supabase → Edge Functions → Secrets.
- Expo access token for publishing: add `EXPO_TOKEN` in the Claude Code cloud environment settings (never in chat or code).
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (public values, same as `.env`) are also saved as EAS environment variables for development, preview and production. Builds and updates run with `--environment` read those, not `.env`; without them the app says "Supabase is not configured".
- Supabase "Confirm email" is currently **off** for testing. Turn it back on before launch and set the auth Site URL / redirect page.

## Publishing

- Website: `npx expo export -p web --clear` then `npx eas-cli@latest deploy --prod` (needs `EXPO_TOKEN`).
- Android APK (installable app): `npx eas-cli@latest build -p android --profile preview` (needs `EXPO_TOKEN`).
- Over-the-air update to installed apps (JS/design/text changes, no reinstall): `npx eas-cli@latest update --channel preview --message "<what changed>" --environment preview`. Installed apps download it on next open and apply it on the open after that. Native changes (new native library, app.json permissions/plugins, app version bump) need a new APK build instead. Updates only reach APKs with the same app version (`runtimeVersion` follows `version` in app.json; 1.1.0 added notifications), so bump the version whenever a native library is added.
- Native development build: `npx expo prebuild --clean`, then `npx expo run:android --device` (or iOS on a Mac), then `npx expo start`.
- Expo Go from a computer: `npx expo start --go --tunnel` and scan the QR code.
- After changing the menu or loyalty rules: `node --experimental-strip-types scripts/build-chat-menu.mjs` and redeploy the `kitchy-chat` function.

## Open items

- Redeploy the `kitchy-chat` function when `ANTHROPIC_API_KEY` is added (its prompt now explains one chef per order and the 15 km radius).
- Home chefs approved before kitchen locations existed (Hamza, Hamdy, Ahmad) must add their location in My kitchen; until then customers don't see them.

- Add `ANTHROPIC_API_KEY` so Kitchy AI answers in the real app.
- Set up Firebase for Android push (see Smart notifications), then rebuild the APK.
- Owner wants to send custom sound files for add-to-cart and order-placed (`assets/sounds/`).
- Real photos per dish (all dishes currently share one koshari photo; `lib/photos.ts` maps dish id → photo) and per chef.
- Before launch: turn email confirmation back on, clear test accounts/orders, rotate any keys that were pasted into chats, publish to the Play Store.
