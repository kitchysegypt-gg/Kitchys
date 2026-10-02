# Kitchy's — Homemade Food Delivery

Customer app for ordering homemade food from mothers and grandmothers ("home chefs"), built with **Expo** (SDK 57, Expo Router) and **Supabase**.

## Features

- **Email + password sign in / sign up** using Supabase Auth
- **Dinner only**: 5 home chefs with 21 dinner dishes and after-dinner desserts (no drinks, no breakfast)
- **Schedule delivery**: as soon as possible, or any day in the next 2 weeks at any time (15-minute steps)
- **Chef reviews**: after ordering, customers rate each chef on food quality, delivery, packaging and value; chef pages show the averages and every review
- **Become a home chef**: anyone can apply from the sign-in screen or More, with an optional photo of themselves and their dishes (each with an optional photo and size in g or kg). Photos are stored in the `kitchen-photos` Supabase Storage bucket. Kitchy's gets an email with Approve / Reject buttons; approved chefs and their dishes appear for customers right away, and chefs manage their dishes in **My kitchen**
- **AI pictures** for every dish and chef (see *AI pictures* below)
- **Full dish details**: description, ingredients, prep time, portion size, and allergy information (or a clear "no common allergens" badge)
- **Delivery location on a map**: drop a pin, drag it, or use your GPS location; the address fills in automatically and is saved with every order (with an "Open in Google Maps" link)
- **Points, ranks and rewards**: 1 point per EGP 10, ranks from Starter to Diamond with point boosts, and rewards (free delivery, EGP and % discounts) bought with points and used as vouchers in the cart
- **Kitchy AI**: an in-app assistant powered by Claude that knows the menu, allergens, and the customer's own orders and points
- **One chef per order, chefs near you**: customers see only chefs within 15 km of their address; adding a dish from another chef offers to start a new cart; chefs give their kitchen location when they apply
- **Smart notifications**: "your cart is calling" and a weekly "we miss you", written by Claude for each customer from their orders and cart (see `PROJECT_NOTES.md`)
- **Clean food-app design**: line icons (Ionicons), flat white cards, a chef photo for every chef, and 3D food pictures for dishes and categories
- **Sound effect + haptic** when you tap *Add to cart*
- **Animated confetti + success sound** when you place an order or redeem a reward
- **Free delivery on the first 3 orders**: a welcome popup when you open the app, a banner that counts down, and a database rule that enforces it
- **"How to use the app" walkthrough** on first launch (you can open it again from Profile)
- **Profile / settings**: language (English, العربية, Français), theme (System, Light, Dark, Sunset, Mint), accent colour (orange, red, green, blue, purple, pink), sound on/off, sign out
- **Refer a friend** (More or Settings): every customer gets a code like `KIT7GJDNF`. A friend enters it at checkout on their first order and the referrer gets 10% of that order (food, after discounts) as Kitchy's credit, which they can switch on in the cart to take off later orders. Cancelling an order in Supabase automatically refunds credit it used and takes back cashback it earned.
- **Chef profile photos**: approved chefs tap their photo in My kitchen to change it
- **5 tabs**: Home, Chefs, Cart, Orders, More. More opens Points, Kitchy AI, delivery address, home chef, Settings and the how-to guide

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
  - `chef_reviews` and the `chef_ratings` view: one review per chef per order, only from the customer's own orders that included that chef's food.
  - `chef_applications`, `kitchen_chefs`, `kitchen_dishes`: home-chef applications, and the chefs and dishes that go live once approved. Orders for those dishes are priced by the server from `kitchen_dishes`.
- **Email confirmation:** Supabase requires new users to confirm their email by default. To let people sign in right after sign-up, turn off *Confirm email* in the Supabase dashboard → Authentication → Sign In / Providers → Email.

### Turn on Kitchy AI

The assistant runs as the Supabase Edge Function `kitchy-chat` (already deployed), which calls Claude with your Anthropic API key. The key stays on the server and never ships in the app.

1. Create an API key at [platform.claude.com](https://platform.claude.com).
2. In the Supabase dashboard → **Edge Functions** → **Secrets**, add `ANTHROPIC_API_KEY` with that key.

Until the key is added, the chat shows "The assistant is not set up yet".

### Chef applications by email

Applications are emailed to **kitchysegypt@gmail.com** by the `chef-applications` Edge Function (already deployed), using [Resend](https://resend.com):

1. Sign up at resend.com **with kitchysegypt@gmail.com** and create an API key.
2. In Supabase → **Edge Functions** → **Secrets**, add `RESEND_API_KEY` (or store it in Vault: `select vault.create_secret('<key>', 'resend_api_key');`). This project already has it in Vault.

Each email lists the applicant's details and dishes with **Approve** and **Reject** buttons. Approving publishes the chef and their dishes in the app immediately.
(Resend's free test sender can only email the address you signed up with. To send from your own domain, verify it in Resend and add `EMAIL_FROM`, e.g. `Kitchy's <apply@yourdomain.com>`.)

Until the key is added, applications are still saved. You can see them in Supabase → Table editor → `chef_applications`, and approve one in the SQL editor with:

```sql
select approve_chef_application('<application id>');
```

## AI pictures

Dish photos and chef portraits are generated with AI through your n8n workflow **"Kitchy's image generator"** (OpenAI image model, paid with n8n gateway credits). Until then, dishes show their 3D food picture and chefs show the shared chef photo (`assets/photos/chef.jpg`).

1. Top up your n8n gateway credits, then **Publish** the workflow in n8n.
2. Run (URL and key are in the workflow's webhook node):
   ```bash
   N8N_IMAGE_URL=https://kitchys.app.n8n.cloud/webhook/kitchys-image-26a654a9 N8N_IMAGE_KEY=<key> node scripts/generate-images.mjs
   ```
3. The pictures land in `assets/photos/` and `lib/photos.ts` is updated. Unpublish the workflow afterwards.

The prompts are in `scripts/image-prompts.json` (chef portraits are illustrated characters, not photos of real people).

## Maps

In **Expo Go** the map works with no setup: Google Maps on Android, Apple Maps on iPhone. For **App Store / Play Store builds** with Google Maps, create Google Maps API keys and add them to the `react-native-maps` config plugin — see the [Expo maps guide](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/#deploy-app-with-google-maps).

## Project structure

```
app/                   Screens (Expo Router)
  (tabs)/              Home, Chefs, Cart, Orders, More
  rewards, chat, settings  Points, Kitchy AI and Settings (opened from More)
  chef/[id].tsx        Chef profile, menu and reviews
  review/[orderId].tsx Rate the chefs from an order
  apply.tsx            Apply as a home chef
  kitchen.tsx          My kitchen (approved chefs manage their dishes)
  dish/[id].tsx        Dish details, allergens, add to cart
  location.tsx         Delivery location on the map
  onboarding.tsx       First-launch "how to use" walkthrough
  auth.tsx             Sign in / create account
components/            UI kit (icons, buttons, cards, lists), logo, confetti, map, dish & chef cards
data/menu.ts           Chefs and dishes (EN / AR / FR)
lib/                   Supabase client, auth, cart, orders + points, loyalty rules, sounds, settings, translations, themes
supabase/migrations/   Database schema and rules
supabase/functions/    kitchy-chat (Claude) and chef-applications (email + approve) Edge Functions
scripts/               Chat menu builder and AI picture generator
assets/photos/         AI dish photos and chef portraits
assets/emoji/          Fluent 3D emoji PNGs for food pictures (MIT license, Microsoft)
assets/photos/chef.jpg Chef photo shown for every chef without their own portrait
assets/sounds/         Sound effects
```

## Changing the menu, prices or rewards

- **Menu:** `data/menu.ts`. If you change a price or add a dish, also update the `dish_prices` table in Supabase (the server uses those prices and each dish's `chef_id`). Chefs who joined through the app manage their own dishes in My kitchen.
- **Ranks and rewards:** `lib/loyalty.ts` for the app, and the `rewards` table / `loyalty_level()` function in Supabase for the server. Keep both in sync.
- **Kitchy AI's knowledge:** after changing any of the above, run `node --experimental-strip-types scripts/build-chat-menu.mjs` and redeploy the `kitchy-chat` function.

## Web demo

`EXPO_PUBLIC_DEMO=1 npx expo export --platform web` builds an offline demo: any email signs in, orders, points, reviews and chef applications stay in the browser, the chat gives sample answers instead of calling Claude, and Profile has a *Demo: approve my application* button so you can try the chef flow.

## Useful commands

```bash
npx expo start        # start the dev server
npx tsc --noEmit      # typecheck
npx expo lint         # lint
```
