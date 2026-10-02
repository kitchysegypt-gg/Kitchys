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

Dinner-only menu from home chefs; dish photos and sizes; cart with scheduling, vouchers, referral code and credit; orders and chef reviews; points, ranks and rewards; refer a friend (10% of the friend's first order as credit, no cap); Kitchy AI chat (Claude); apply as a chef (photos, dishes) → email to the owner with Approve / Reject links → approved chefs manage dishes and photos in My kitchen; languages (English, Arabic, French), themes and accent colours.

## Secrets and settings (values are NOT stored in the repo)

- Resend API key (chef application emails): stored in Supabase Vault as `resend_api_key`; the edge function reads it through `public.app_secret()`.
- `ANTHROPIC_API_KEY` for Kitchy AI: **not set yet**. Add it in Supabase → Edge Functions → Secrets.
- Expo access token for publishing: add `EXPO_TOKEN` in the Claude Code cloud environment settings (never in chat or code).
- Supabase "Confirm email" is currently **off** for testing. Turn it back on before launch and set the auth Site URL / redirect page.

## Publishing

- Website: `npx expo export -p web --clear` then `npx eas-cli@latest deploy --prod` (needs `EXPO_TOKEN`).
- Native development build: `npx expo prebuild --clean`, then `npx expo run:android --device` (or iOS on a Mac), then `npx expo start`.
- Expo Go from a computer: `npx expo start --go --tunnel` and scan the QR code.
- After changing the menu or loyalty rules: `node --experimental-strip-types scripts/build-chat-menu.mjs` and redeploy the `kitchy-chat` function.

## Open items

- Add `ANTHROPIC_API_KEY` so Kitchy AI answers in the real app.
- Owner wants to send custom sound files for add-to-cart and order-placed (`assets/sounds/`).
- Real photos per dish (all dishes currently share one koshari photo; `lib/photos.ts` maps dish id → photo) and per chef.
- Optional: Android APK via `eas build -p android --profile preview` for installing without Expo Go.
- Before launch: turn email confirmation back on, clear test accounts/orders, rotate any keys that were pasted into chats, publish to the Play Store.
