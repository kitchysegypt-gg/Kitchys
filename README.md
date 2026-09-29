# Kitchy's — Homemade Food Delivery

Customer app for ordering homemade food from mothers and grandmothers ("home chefs"), built with **Expo** (SDK 57, Expo Router) and **Supabase**.

## Features

- **Email + password sign in / sign up** using Supabase Auth
- **5 home chefs**, each with their own menu (22 dishes in total)
- **Full dish details**: description, ingredients, prep time, portion size, and allergy information (or a clear "no common allergens" badge)
- **3D emojis everywhere** (Microsoft Fluent 3D emoji) with floating/swaying animations, plus chunky 3D buttons and cards
- **Sound effect + haptic** when you tap *Add to cart*
- **Animated confetti + success sound** when you place an order
- **Free delivery on the first 3 orders**: a welcome popup when you open the app, a banner that counts down, and a database rule that enforces it
- **"How to use the app" walkthrough** on first launch (you can open it again from Settings)
- **Settings**: language (English, العربية, Français), theme (System, Light, Dark, Sunset, Mint), sound on/off, sign out
- **5 tabs**: Home, Chefs, Cart, Orders, Settings

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
- Schema: [`supabase/migrations/20260929000000_create_orders.sql`](supabase/migrations/20260929000000_create_orders.sql)
  - `orders` table. Customers can only read and create their own orders (RLS).
  - A trigger sets `delivery_fee` to **0 for a customer's first 3 orders** and 30 EGP after that, and calculates `total`.
- **Email confirmation:** Supabase requires new users to confirm their email by default. To let people sign in right after sign-up, turn off *Confirm email* in the Supabase dashboard → Authentication → Sign In / Providers → Email.

## Project structure

```
app/                 Screens (Expo Router)
  (tabs)/            Home, Chefs, Cart, Orders, Settings
  chef/[id].tsx      Chef profile + menu
  dish/[id].tsx      Dish details, allergens, add to cart
  onboarding.tsx     First-launch "how to use" walkthrough
  auth.tsx           Sign in / create account
components/          3D emoji, 3D buttons/cards, confetti, dish & chef cards
data/menu.ts         Chefs and dishes (EN / AR / FR)
lib/                 Supabase client, auth, cart, orders, sounds, settings, translations, themes
assets/emoji/        Fluent 3D emoji PNGs (MIT license, Microsoft)
assets/sounds/       Add-to-cart and order-success sound effects
```

## Editing the menu

Chefs and dishes live in `data/menu.ts`. Each dish has a name, description and ingredients in all three languages, a list of `allergens` (use an empty list `[]` for none), a price in EGP, and a 3D emoji from `assets/emoji`.

## Useful commands

```bash
npx expo start        # start the dev server
npx tsc --noEmit      # typecheck
npx expo lint         # lint
```
