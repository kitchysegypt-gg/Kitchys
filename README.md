# Kitchy's — Homemade Food Delivery

Customer app for ordering homemade food from mothers and grandmothers ("home chefs"), built with **Expo** (SDK 57, Expo Router) and **Supabase**.

## Features

- **Email + password sign in / sign up** using Supabase Auth
- **5 home chefs**, each with their own menu (22 dishes in total)
- **Full dish details**: description, ingredients, prep time, portion size, and allergy information (or a clear "no common allergens" badge)
- **Delivery location on a map**: drop a pin, drag it, or use your GPS location; the address fills in automatically and is saved with every order (with an "Open in Google Maps" link)
- **Points, ranks and rewards**: 1 point per EGP 10, ranks from Starter to Diamond with point boosts, and rewards (free delivery, EGP and % discounts) bought with points and used as vouchers in the cart
- **Kitchy AI**: an in-app assistant powered by Claude that knows the menu, allergens, and the customer's own orders and points
- **3D emojis everywhere** (Microsoft Fluent 3D emoji), chunky 3D buttons and cards
- **Sound effect + haptic** when you tap *Add to cart*
- **Animated confetti + success sound** when you place an order or redeem a reward
- **Free delivery on the first 3 orders**: a welcome popup when you open the app, a banner that counts down, and a database rule that enforces it
- **"How to use the app" walkthrough** on first launch (you can open it again from Profile)
- **Profile / settings**: language (English, العربية, Français), theme (System, Light, Dark, Sunset, Mint), sound on/off, sign out
- **7 tabs**: Home, Chefs, Cart, Orders, Points, Ask AI, Profile

## Run it on your phone with Expo Go

1. Install **Expo Go** from the App Store / Google Play.
2. On your computer (Node.js 20+):
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with your phone camera (iOS) or the Expo Go app (Android).

The Supabase project URL and publishable key are already in `.env`. They are safe to ship in the app because Row Level Security protects the data.

## Supabase

- Project: `Kitchyswww` (`qbyzamcxlxarslfeglfl`)
- Migrations in [`supabase/migrations`](supabase/migrations):
  - `orders`: customers can only read and create their own orders (RLS).
  - `dish_prices`: the server's price list. **Order totals, delivery fee, discounts and points are all calculated by a database trigger**, so the app can't be tricked into cheaper orders or extra points.
  - `rewards` and `reward_vouchers`: the rewards catalogue and the vouchers each customer bought. `redeem_reward()` checks rank and balance before issuing a voucher.
- **Email confirmation:** Supabase requires new users to confirm their email by default. To let people sign in right after sign-up, turn off *Confirm email* in the Supabase dashboard → Authentication → Sign In / Providers → Email.

### Turn on Kitchy AI

The assistant runs as the Supabase Edge Function `kitchy-chat` (already deployed), which calls Claude with your Anthropic API key. The key stays on the server and never ships in the app.

1. Create an API key at [platform.claude.com](https://platform.claude.com).
2. In the Supabase dashboard → **Edge Functions** → **Secrets**, add `ANTHROPIC_API_KEY` with that key.

Until the key is added, the chat shows "The assistant is not set up yet".

## Maps

In **Expo Go** the map works with no setup: Google Maps on Android, Apple Maps on iPhone. For **App Store / Play Store builds** with Google Maps, create Google Maps API keys and add them to the `react-native-maps` config plugin — see the [Expo maps guide](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/#deploy-app-with-google-maps).

## Project structure

```
app/                   Screens (Expo Router)
  (tabs)/              Home, Chefs, Cart, Orders, Points (rewards), Ask AI (chat), Profile (settings)
  chef/[id].tsx        Chef profile + menu
  dish/[id].tsx        Dish details, allergens, add to cart
  location.tsx         Delivery location on the map
  onboarding.tsx       First-launch "how to use" walkthrough
  auth.tsx             Sign in / create account
components/            3D emoji, logo, 3D buttons/cards, confetti, map, dish & chef cards
data/menu.ts           Chefs and dishes (EN / AR / FR)
lib/                   Supabase client, auth, cart, orders + points, loyalty rules, sounds, settings, translations, themes
supabase/migrations/   Database schema and rules
supabase/functions/    kitchy-chat Edge Function (Claude)
assets/emoji/          Fluent 3D emoji PNGs (MIT license, Microsoft)
assets/sounds/         Sound effects
```

## Changing the menu, prices or rewards

- **Menu:** `data/menu.ts`. If you change a price or add a dish, also update the `dish_prices` table in Supabase (the server uses those prices).
- **Ranks and rewards:** `lib/loyalty.ts` for the app, and the `rewards` table / `loyalty_level()` function in Supabase for the server. Keep both in sync.
- **Kitchy AI's knowledge:** after changing any of the above, run `node --experimental-strip-types scripts/build-chat-menu.mjs` and redeploy the `kitchy-chat` function.

## Web demo

`EXPO_PUBLIC_DEMO=1 npx expo export --platform web` builds an offline demo: any email signs in, orders and points stay in the browser, and the chat gives sample answers instead of calling Claude.

## Useful commands

```bash
npx expo start        # start the dev server
npx tsc --noEmit      # typecheck
npx expo lint         # lint
```
