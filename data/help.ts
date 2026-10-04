import type { IconName } from '@/components/ui';
import type { Localized } from '@/lib/i18n';

/** One topic in the Help & guide screen: numbered steps and an optional tip. */
export type HelpTopic = {
  id: string;
  icon: IconName;
  title: Localized;
  steps: Localized[];
  tip?: Localized;
};

export type HelpAudience = 'customer' | 'chef';

/** Everything a customer needs to know, in the order they'll need it. */
export const CUSTOMER_HELP: HelpTopic[] = [
  {
    id: 'start',
    icon: 'person-add-outline',
    title: { en: 'Create your account', ar: 'اعمل حسابك', fr: 'Créer votre compte' },
    steps: [
      {
        en: 'Open Kitchy\'s and pick your language at the top: English, العربية or Français. You can change it later in Settings.',
        ar: 'افتح كيتشيز واختار اللغة من فوق: English أو العربية أو Français. تقدر تغيّرها بعدين من الإعدادات.',
        fr: 'Ouvrez Kitchy\'s et choisissez votre langue en haut : English, العربية ou Français. Vous pourrez la changer dans les Réglages.',
      },
      {
        en: 'Tap {noAccount}, then write your name, your email and a password (6 letters or numbers at least).',
        ar: 'دوس على {noAccount}، واكتب اسمك وإيميلك وباسورد (٦ حروف أو أرقام على الأقل).',
        fr: 'Touchez {noAccount}, puis saisissez votre nom, votre e-mail et un mot de passe (6 caractères minimum).',
      },
      {
        en: 'Tap {signUp}. Next time, just type your email and password and tap {signIn}.',
        ar: 'دوس {signUp}. المرة الجاية اكتب إيميلك والباسورد ودوس {signIn} بس.',
        fr: 'Touchez {signUp}. La prochaine fois, saisissez votre e-mail et votre mot de passe et touchez {signIn}.',
      },
    ],
    tip: {
      en: 'If the app asks for a 6-digit code, open your email, find the message from Kitchy\'s and type the code.',
      ar: 'لو التطبيق طلب كود من ٦ أرقام، افتح الإيميل ودوّر على رسالة كيتشيز واكتب الكود.',
      fr: 'Si l\'application demande un code à 6 chiffres, ouvrez vos e-mails, trouvez le message de Kitchy\'s et saisissez le code.',
    },
  },
  {
    id: 'address',
    icon: 'location-outline',
    title: { en: 'Set your delivery address', ar: 'حدد عنوان التوصيل', fr: 'Indiquer votre adresse' },
    steps: [
      {
        en: 'On the Home screen, tap {deliveryTo} at the very top.',
        ar: 'في الصفحة الرئيسية، دوس على {deliveryTo} اللي فوق خالص.',
        fr: 'Sur l\'écran d\'accueil, touchez {deliveryTo} tout en haut.',
      },
      {
        en: 'Tap {useMyLocation}, or move the map with your finger until the pin is exactly on your building.',
        ar: 'دوس {useMyLocation}، أو حرّك الخريطة بصباعك لحد ما الدبوس ييجي على عمارتك بالظبط.',
        fr: 'Touchez {useMyLocation}, ou déplacez la carte avec le doigt jusqu\'à ce que l\'épingle soit sur votre immeuble.',
      },
      {
        en: 'Add the details: street, building number, floor and apartment, then save.',
        ar: 'اكتب التفاصيل: الشارع ورقم العمارة والدور والشقة، وبعدين احفظ.',
        fr: 'Ajoutez les détails : rue, numéro d\'immeuble, étage et appartement, puis enregistrez.',
      },
    ],
    tip: {
      en: 'You only see chefs within 15 km of this address, so the food arrives fresh and hot.',
      ar: 'هتشوف الشيفات اللي على بُعد ١٥ كيلو من العنوان ده بس، عشان الأكل يوصل سخن وطازة.',
      fr: 'Vous ne voyez que les chefs à moins de 15 km de cette adresse, pour que les plats arrivent chauds.',
    },
  },
  {
    id: 'browse',
    icon: 'search-outline',
    title: { en: 'Find food you\'ll love', ar: 'دوّر على الأكل اللي بتحبه', fr: 'Trouver des plats' },
    steps: [
      {
        en: 'Swipe the banners at the top to see offers.',
        ar: 'اسحب البانرات اللي فوق عشان تشوف العروض.',
        fr: 'Faites glisser les bannières en haut pour voir les offres.',
      },
      {
        en: 'Tap a round category ({catMain}, {catBaked}, {catSeafood}, {catDesserts}, {catHealthy}) to see only those dishes. Tap it again to see everything.',
        ar: 'دوس على قسم من الدواير ({catMain}، {catBaked}، {catSeafood}، {catDesserts}، {catHealthy}) عشان تشوف أكلاته بس. دوس عليه تاني عشان ترجع تشوف كله.',
        fr: 'Touchez une catégorie ronde ({catMain}, {catBaked}, {catSeafood}, {catDesserts}, {catHealthy}) pour ne voir que ces plats. Touchez-la à nouveau pour tout voir.',
      },
      {
        en: 'Use the search box to look for a dish or a chef by name.',
        ar: 'استخدم خانة البحث عشان تدور على أكلة أو شيف بالاسم.',
        fr: 'Utilisez la barre de recherche pour trouver un plat ou un chef par son nom.',
      },
      {
        en: 'Under {kitchensNearYou}, tap a chef to see all their dishes, their rating and what other customers said.',
        ar: 'تحت {kitchensNearYou}، دوس على أي شيف عشان تشوف كل أكلاته وتقييمه والزباين قالوا إيه.',
        fr: 'Dans {kitchensNearYou}, touchez un chef pour voir tous ses plats, sa note et les avis des clients.',
      },
    ],
    tip: {
      en: 'Badges help you choose: Verified (checked by Kitchy\'s), Homemade, and Popular (many orders this month).',
      ar: 'العلامات بتساعدك تختار: موثّق (كيتشيز اتأكدت منه)، بيتي، ومشهور (عليه طلبات كتير الشهر ده).',
      fr: 'Les badges vous aident : Vérifié (contrôlé par Kitchy\'s), Fait maison, et Populaire (beaucoup de commandes ce mois-ci).',
    },
  },
  {
    id: 'dish',
    icon: 'restaurant-outline',
    title: { en: 'Look at a dish and add it', ar: 'شوف الأكلة وضيفها', fr: 'Voir un plat et l\'ajouter' },
    steps: [
      {
        en: 'Tap a dish. Swipe its photos, and read the price, size, how many people it serves, the ingredients and the allergy information.',
        ar: 'دوس على الأكلة. اسحب الصور، واقرا السعر والحجم وتكفي كام فرد والمكونات ومعلومات الحساسية.',
        fr: 'Touchez un plat. Faites défiler les photos et lisez le prix, la portion, le nombre de personnes, les ingrédients et les allergènes.',
      },
      {
        en: 'Choose how many with − and +, then tap {addToCart}. The small + on a dish card adds one straight away.',
        ar: 'اختار العدد بـ − و +، ودوس {addToCart}. علامة + الصغيرة اللي على كارت الأكلة بتضيف واحدة على طول.',
        fr: 'Choisissez la quantité avec − et +, puis touchez {addToCart}. Le petit + sur la carte d\'un plat en ajoute un directement.',
      },
      {
        en: 'One order is from one chef. If you add a dish from another chef, the app asks if you want to start a new cart.',
        ar: 'الطلب الواحد بيكون من شيف واحد. لو ضفت أكلة من شيف تاني، التطبيق هيسألك لو عايز تبدأ سلة جديدة.',
        fr: 'Une commande = un seul chef. Si vous ajoutez le plat d\'un autre chef, l\'application vous propose de recommencer le panier.',
      },
    ],
    tip: {
      en: '"Only 3 left today" means the chef cooks a limited amount. "Sold out today" means you can still schedule it for another day.',
      ar: '"فاضل ٣ بس النهارده" يعني الشيف بيطبخ كمية محدودة. "خلصت النهارده" يعني تقدر تطلبها ليوم تاني.',
      fr: '« Plus que 3 aujourd\'hui » : le chef cuisine une quantité limitée. « Épuisé aujourd\'hui » : vous pouvez la programmer pour un autre jour.',
    },
  },
  {
    id: 'time',
    icon: 'time-outline',
    title: { en: 'Choose when it arrives', ar: 'اختار ميعاد التوصيل', fr: 'Choisir l\'heure de livraison' },
    steps: [
      {
        en: 'Kitchens open at 10 AM. Each chef has a last delivery time (usually 9 PM).',
        ar: 'المطابخ بتفتح الساعة ١٠ الصبح. كل شيف ليه آخر ميعاد توصيل (غالباً ٩ بالليل).',
        fr: 'Les cuisines ouvrent à 10 h. Chaque chef a une heure de dernière livraison (souvent 21 h).',
      },
      {
        en: 'In the cart, pick {asap} (45–60 minutes) or {schedule} to choose a day (up to 2 weeks ahead) and a time.',
        ar: 'في السلة، اختار {asap} (٤٥–٦٠ دقيقة) أو {schedule} عشان تختار يوم (لحد أسبوعين قدام) وساعة.',
        fr: 'Dans le panier, choisissez {asap} (45–60 min) ou {schedule} pour choisir un jour (jusqu\'à 2 semaines) et une heure.',
      },
      {
        en: 'If the kitchen is closed when you order, the earliest delivery the next day is 1 PM, so the chef has the morning to cook.',
        ar: 'لو المطبخ مقفول وانت بتطلب، أول ميعاد توصيل تاني يوم هو ١ الضهر، عشان الشيف ياخد الصبح يطبخ.',
        fr: 'Si la cuisine est fermée quand vous commandez, la première livraison le lendemain est à 13 h, pour laisser au chef la matinée pour cuisiner.',
      },
    ],
  },
  {
    id: 'order',
    icon: 'bag-check-outline',
    title: { en: 'Place your order', ar: 'اطلب', fr: 'Passer commande' },
    steps: [
      {
        en: 'Open the {tabCart} tab. Check the dishes, your address and the delivery time.',
        ar: 'افتح تاب {tabCart}. راجع الأكلات والعنوان وميعاد التوصيل.',
        fr: 'Ouvrez l\'onglet {tabCart}. Vérifiez les plats, l\'adresse et l\'heure de livraison.',
      },
      {
        en: 'Write a note for the chef if you like, for example "less salt" or "no onions".',
        ar: 'اكتب ملاحظة للشيف لو حابب، زي "ملح أقل" أو "من غير بصل".',
        fr: 'Ajoutez une note pour le chef si vous le souhaitez, par exemple « moins de sel » ou « sans oignons ».',
      },
      {
        en: 'Your first 3 orders have free delivery. After that delivery is EGP 30, unless you use a free-delivery reward.',
        ar: 'أول ٣ طلبات توصيلهم ببلاش. بعد كده التوصيل بـ ٣٠ جنيه، إلا لو استخدمت مكافأة توصيل مجاني.',
        fr: 'Vos 3 premières commandes sont livrées gratuitement. Ensuite la livraison coûte 30 EGP, sauf avec une récompense de livraison gratuite.',
      },
      {
        en: 'Use a voucher, a friend\'s referral code (first order only) or your credit if you have them.',
        ar: 'استخدم كوبون أو كود صاحبك (أول طلب بس) أو رصيدك لو عندك.',
        fr: 'Utilisez un bon, le code de parrainage d\'un ami (première commande uniquement) ou votre crédit si vous en avez.',
      },
      {
        en: 'Tap {placeOrder}. For now you pay in cash when your food arrives.',
        ar: 'دوس {placeOrder}. دلوقتي الدفع كاش لما الأكل يوصلك.',
        fr: 'Touchez {placeOrder}. Pour l\'instant, vous payez en espèces à la livraison.',
      },
    ],
  },
  {
    id: 'track',
    icon: 'receipt-outline',
    title: { en: 'Follow your order', ar: 'تابع طلبك', fr: 'Suivre votre commande' },
    steps: [
      {
        en: 'Open the {tabOrders} tab to see each order and its status.',
        ar: 'افتح تاب {tabOrders} عشان تشوف كل طلب وحالته.',
        fr: 'Ouvrez l\'onglet {tabOrders} pour voir chaque commande et son état.',
      },
      {
        en: 'Placed → Cooking (the chef accepted it) → On the way → Delivered. It changes by itself, and you get a notification at each step.',
        ar: 'اتطلب ← بيتطبخ (الشيف قبله) ← في الطريق ← اتوصّل. بيتغير لوحده، وهيوصلك إشعار مع كل خطوة.',
        fr: 'Passée → En cuisine (le chef l\'a acceptée) → En route → Livrée. L\'état change tout seul et vous recevez une notification à chaque étape.',
      },
      {
        en: 'If a chef can\'t take your order, it shows "Cancelled" and any credit you used comes back to you.',
        ar: 'لو الشيف مقدرش ياخد طلبك، هيظهر "اتلغى" وأي رصيد استخدمته هيرجعلك.',
        fr: 'Si un chef ne peut pas prendre votre commande, elle passe à « Annulée » et le crédit utilisé vous est rendu.',
      },
    ],
  },
  {
    id: 'review',
    icon: 'star-outline',
    title: { en: 'Rate your chef', ar: 'قيّم الشيف', fr: 'Noter votre chef' },
    steps: [
      {
        en: 'After your food is delivered, open the {tabOrders} tab and tap {rateOrder}.',
        ar: 'بعد ما الأكل يوصل، افتح تاب {tabOrders} ودوس {rateOrder}.',
        fr: 'Une fois livré, ouvrez l\'onglet {tabOrders} et touchez {rateOrder}.',
      },
      {
        en: 'Give stars for the food, the delivery, the packaging and the value for money, and write a few words if you like.',
        ar: 'ادّي نجوم للأكل والتوصيل والتغليف والسعر مقابل الجودة، واكتب كلمتين لو حابب.',
        fr: 'Donnez des étoiles pour le plat, la livraison, l\'emballage et le rapport qualité-prix, et ajoutez un commentaire si vous voulez.',
      },
      {
        en: 'The chef can answer your review. Their reply shows under it on the chef\'s page.',
        ar: 'الشيف يقدر يرد على تقييمك، وردّه بيظهر تحته في صفحة الشيف.',
        fr: 'Le chef peut répondre à votre avis. Sa réponse apparaît en dessous, sur sa page.',
      },
    ],
  },
  {
    id: 'points',
    icon: 'trophy-outline',
    title: { en: 'Points, ranks and rewards', ar: 'النقط والمستويات والمكافآت', fr: 'Points, rangs et récompenses' },
    steps: [
      {
        en: 'Every EGP 10 you spend gives you 1 point. Open {tabMore} → {kitchysPoints} to see your points.',
        ar: 'كل ١٠ جنيه بتصرفهم بياخدوك نقطة. افتح {tabMore} ← {kitchysPoints} عشان تشوف نقطك.',
        fr: 'Chaque tranche de 10 EGP dépensée vous donne 1 point. Ouvrez {tabMore} → {kitchysPoints} pour les voir.',
      },
      {
        en: 'The more you order, the higher your rank: Starter, Bronze, Silver, Gold, Platinum, Diamond. Higher ranks earn more points per order.',
        ar: 'كل ما تطلب أكتر مستواك يعلى: مبتدئ، برونزي، فضي، ذهبي، بلاتيني، ماسي. المستويات الأعلى بتاخد نقط أكتر في كل طلب.',
        fr: 'Plus vous commandez, plus votre rang monte : Débutant, Bronze, Argent, Or, Platine, Diamant. Les rangs élevés gagnent plus de points.',
      },
      {
        en: 'Swap your points for rewards like free delivery or money off, then choose the voucher in your cart.',
        ar: 'بدّل نقطك بمكافآت زي توصيل مجاني أو خصم، وبعدين اختار الكوبون في السلة.',
        fr: 'Échangez vos points contre des récompenses (livraison offerte, réductions), puis choisissez le bon dans votre panier.',
      },
    ],
  },
  {
    id: 'refer',
    icon: 'gift-outline',
    title: { en: 'Invite friends', ar: 'ادعي صحابك', fr: 'Inviter des amis' },
    steps: [
      {
        en: 'Open {tabMore} → {referFriend} and share your code.',
        ar: 'افتح {tabMore} ← {referFriend}، وابعت الكود بتاعك.',
        fr: 'Ouvrez {tabMore} → {referFriend} et partagez votre code.',
      },
      {
        en: 'Your friend types your code in their cart on their first order.',
        ar: 'صاحبك يكتب الكود بتاعك في السلة في أول طلب ليه.',
        fr: 'Votre ami saisit votre code dans son panier lors de sa première commande.',
      },
      {
        en: 'You get 10% of their first order as credit to spend on your next meals.',
        ar: 'هتاخد ١٠٪ من قيمة أول طلب ليه رصيد تصرفه على أكلك الجاي.',
        fr: 'Vous recevez 10 % de sa première commande en crédit pour vos prochains repas.',
      },
    ],
  },
  {
    id: 'ai',
    icon: 'chatbubble-ellipses-outline',
    title: { en: 'Ask Kitchy AI', ar: 'اسأل كيتشي AI', fr: 'Demander à Kitchy AI' },
    steps: [
      {
        en: 'Tap the chat button at the top of the Home screen (or {tabMore} → {chatTitle}).',
        ar: 'دوس على زرار الشات اللي فوق في الصفحة الرئيسية (أو {tabMore} ← {chatTitle}).',
        fr: 'Touchez le bouton de discussion en haut de l\'accueil (ou {tabMore} → {chatTitle}).',
      },
      {
        en: 'Ask anything: "What can I eat that\'s healthy tonight?", "How does delivery work?"',
        ar: 'اسأل أي حاجة: "آكل إيه صحي النهارده؟"، "التوصيل بيشتغل إزاي؟"',
        fr: 'Posez n\'importe quelle question : « Que manger de sain ce soir ? », « Comment marche la livraison ? »',
      },
    ],
  },
  {
    id: 'settings',
    icon: 'settings-outline',
    title: { en: 'Notifications and settings', ar: 'الإشعارات والإعدادات', fr: 'Notifications et réglages' },
    steps: [
      {
        en: 'When the app asks, tap "Allow" for notifications so you hear about your order and offers.',
        ar: 'لما التطبيق يسألك، دوس "سماح" للإشعارات عشان يوصلك خبر طلبك والعروض.',
        fr: 'Quand l\'application le demande, touchez « Autoriser » les notifications pour suivre vos commandes et les offres.',
      },
      {
        en: 'In Settings (the gear at the top of Home) you can change the language, the colours, sounds and notifications.',
        ar: 'من الإعدادات (الترس اللي فوق في الرئيسية) تقدر تغيّر اللغة والألوان والأصوات والإشعارات.',
        fr: 'Dans les Réglages (la roue en haut de l\'accueil), changez la langue, les couleurs, les sons et les notifications.',
      },
    ],
  },
  {
    id: 'trouble',
    icon: 'help-buoy-outline',
    title: { en: 'Something not working?', ar: 'في حاجة مش شغالة؟', fr: 'Un souci ?' },
    steps: [
      {
        en: 'No chefs showing? Check your delivery address. Chefs only deliver within 15 km.',
        ar: 'مفيش شيفات ظاهرة؟ راجع عنوان التوصيل. الشيفات بتوصّل لحد ١٥ كيلو بس.',
        fr: 'Aucun chef ? Vérifiez votre adresse : les chefs livrent jusqu\'à 15 km.',
      },
      {
        en: '"Not taking orders right now" means the chef paused their kitchen. Try another chef or come back later.',
        ar: '"مش بياخد طلبات دلوقتي" يعني الشيف وقّف مطبخه شوية. جرّب شيف تاني أو ارجع بعدين.',
        fr: '« Ne prend pas de commandes » : le chef a mis sa cuisine en pause. Essayez un autre chef ou revenez plus tard.',
      },
      {
        en: 'App looks old? Close it fully and open it again twice to get the latest update.',
        ar: 'التطبيق شكله قديم؟ اقفله خالص وافتحه تاني مرتين عشان ينزل آخر تحديث.',
        fr: 'L\'application semble ancienne ? Fermez-la complètement et rouvrez-la deux fois pour obtenir la mise à jour.',
      },
    ],
  },
];

/** Everything a home chef needs, from applying to running the kitchen every day. */
export const CHEF_HELP: HelpTopic[] = [
  {
    id: 'apply',
    icon: 'document-text-outline',
    title: { en: 'Become a home chef', ar: 'ابقي شيف بيتي', fr: 'Devenir chef à domicile' },
    steps: [
      {
        en: 'Create an account (or sign in), then open {tabMore} → {becomeChef}. You can also tap {applyChefLink} on the sign-in screen.',
        ar: 'اعملي حساب (أو سجّلي دخول)، وافتحي {tabMore} ← {becomeChef}. أو دوسي {applyChefLink} في صفحة الدخول.',
        fr: 'Créez un compte (ou connectez-vous), puis ouvrez {tabMore} → {becomeChef}. Vous pouvez aussi toucher {applyChefLink} sur l\'écran de connexion.',
      },
      {
        en: 'Add a nice photo of yourself, your phone number, your area, what you cook best and a few words about you.',
        ar: 'حطي صورة حلوة ليكي، ورقم تليفونك، ومنطقتك، وأكتر حاجة بتعرفي تطبخيها، وكلمتين عن نفسك.',
        fr: 'Ajoutez une jolie photo de vous, votre téléphone, votre quartier, votre spécialité et quelques mots sur vous.',
      },
      {
        en: 'Set your kitchen location on the map. It stays private: customers only see that you are near them.',
        ar: 'حددي مكان مطبخك على الخريطة. المكان بيفضل سري: الزباين بيعرفوا بس إنك قريبة منهم.',
        fr: 'Placez votre cuisine sur la carte. L\'adresse reste privée : les clients voient seulement que vous êtes proche.',
      },
      {
        en: 'Add at least one dish (see "Add a dish"), then tap {submitApplication}. We check it and tell you when you\'re approved.',
        ar: 'ضيفي أكلة واحدة على الأقل (شوفي "ضيفي أكلة")، ودوسي {submitApplication}. هنراجعه ونقولك لما تتقبلي.',
        fr: 'Ajoutez au moins un plat (voir « Ajouter un plat »), puis touchez {submitApplication}. Nous vérifions et vous prévenons dès que vous êtes acceptée.',
      },
    ],
  },
  {
    id: 'open',
    icon: 'storefront-outline',
    title: { en: 'Open your kitchen', ar: 'افتحي مطبخك', fr: 'Ouvrir votre cuisine' },
    steps: [
      {
        en: 'After approval, open {tabMore} → {myKitchen}. This is your own space to run your kitchen.',
        ar: 'بعد الموافقة، افتحي {tabMore} ← {myKitchen}. ده المكان بتاعك اللي بتديري منه مطبخك.',
        fr: 'Après l\'approbation, ouvrez {tabMore} → {myKitchen}. C\'est votre espace pour gérer votre cuisine.',
      },
      {
        en: 'At the bottom there are 5 tabs: {kitchenDashboard} (your numbers), {kitchenOrders}, {kitchenMenu} (your dishes), {kitchenReviews}, and {kitchenSettings} (your settings).',
        ar: 'تحت فيه ٥ تابات: {kitchenDashboard} (أرقامك)، {kitchenOrders}، {kitchenMenu} (أكلاتك)، {kitchenReviews}، و{kitchenSettings} (إعداداتك).',
        fr: 'En bas, 5 onglets : {kitchenDashboard} (vos chiffres), {kitchenOrders}, {kitchenMenu} (vos plats), {kitchenReviews} et {kitchenSettings} (vos réglages).',
      },
      {
        en: 'To go back to ordering food yourself, tap the back arrow at the top.',
        ar: 'عشان ترجعي تطلبي أكل لنفسك، دوسي على السهم اللي فوق.',
        fr: 'Pour revenir à la partie client, touchez la flèche en haut.',
      },
    ],
  },
  {
    id: 'location',
    icon: 'home-outline',
    title: { en: 'Your kitchen location (very important)', ar: 'مكان مطبخك (مهم جداً)', fr: 'Adresse de la cuisine (très important)' },
    steps: [
      {
        en: 'Open the {kitchenSettings} tab. If you see a red warning, your location is missing and customers can\'t see you.',
        ar: 'افتحي تاب {kitchenSettings}. لو شايفة تحذير أحمر يبقى مكانك مش متحدد والزباين مش شايفينك.',
        fr: 'Ouvrez l\'onglet {kitchenSettings}. Un avertissement rouge signifie que l\'adresse manque et que les clients ne vous voient pas.',
      },
      {
        en: 'Tap {useWhereIAm} while you are in your kitchen, or move the map until the pin is on your home.',
        ar: 'دوسي {useWhereIAm} وانتي في المطبخ، أو حرّكي الخريطة لحد ما الدبوس ييجي على بيتك.',
        fr: 'Touchez {useWhereIAm} depuis votre cuisine, ou déplacez la carte jusqu\'à votre maison.',
      },
      {
        en: 'Tap {saveKitchenLocation}. Customers within 15 km can now order from you.',
        ar: 'دوسي {saveKitchenLocation}. دلوقتي الزباين اللي على بُعد ١٥ كيلو يقدروا يطلبوا منك.',
        fr: 'Touchez {saveKitchenLocation}. Les clients à moins de 15 km peuvent maintenant commander chez vous.',
      },
    ],
  },
  {
    id: 'hours',
    icon: 'time-outline',
    title: { en: 'Your working hours', ar: 'مواعيد شغلك', fr: 'Vos horaires' },
    steps: [
      {
        en: 'Customers can order from 10 AM until your {lastDeliveryTitle}. Set it in the {kitchenSettings} tab with − and + (from 1 PM to 11 PM), then tap {saveLastDelivery}.',
        ar: 'الزباين يقدروا يطلبوا من ١٠ الصبح لحد {lastDeliveryTitle}. حدديه من تاب {kitchenSettings} بـ − و + (من ١ الضهر لـ ١١ بالليل)، ودوسي {saveLastDelivery}.',
        fr: 'Les clients commandent de 10 h jusqu\'à votre {lastDeliveryTitle}. Réglez-la dans l\'onglet {kitchenSettings} avec − et + (de 13 h à 23 h), puis touchez {saveLastDelivery}.',
      },
      {
        en: 'Orders placed at night or early morning start at 1 PM, so you always have the morning to shop and cook.',
        ar: 'الطلبات اللي بتيجي بالليل أو بدري الصبح بتبدأ من ١ الضهر، عشان دايماً يبقى عندك الصبح تشتري وتطبخي.',
        fr: 'Les commandes passées la nuit ou tôt le matin commencent à 13 h : vous avez toujours la matinée pour acheter et cuisiner.',
      },
      {
        en: 'Customers can also order days ahead. Check the delivery time written on every order.',
        ar: 'الزباين كمان يقدروا يطلبوا قبلها بأيام. بصّي على ميعاد التوصيل المكتوب على كل طلب.',
        fr: 'Les clients peuvent aussi commander plusieurs jours à l\'avance. Regardez l\'heure de livraison écrite sur chaque commande.',
      },
    ],
  },
  {
    id: 'dish',
    icon: 'add-circle-outline',
    title: { en: 'Add a dish', ar: 'ضيفي أكلة', fr: 'Ajouter un plat' },
    steps: [
      {
        en: 'Open the {kitchenMenu} tab and tap {addDish}.',
        ar: 'افتحي تاب {kitchenMenu} ودوسي {addDish}.',
        fr: 'Ouvrez l\'onglet {kitchenMenu} et touchez {addDish}.',
      },
      {
        en: 'Write the name, a description (at least 10 words: how you cook it, what it tastes like) and the ingredients.',
        ar: 'اكتبي الاسم، ووصف (١٠ كلمات على الأقل: بتطبخيها إزاي وطعمها عامل إزاي)، والمكونات.',
        fr: 'Écrivez le nom, une description (au moins 10 mots : comment vous le préparez, son goût) et les ingrédients.',
      },
      {
        en: 'Add the price in EGP, the cooking time, how many people it serves and the size (grams or kg).',
        ar: 'حطي السعر بالجنيه، ووقت الطبخ، وتكفي كام فرد، والحجم (جرام أو كيلو).',
        fr: 'Indiquez le prix en EGP, le temps de préparation, le nombre de personnes et la portion (g ou kg).',
      },
      {
        en: 'Choose the category, mark allergens (milk, eggs, nuts…), and tick spicy or vegetarian if true.',
        ar: 'اختاري القسم، وعلّمي على مسببات الحساسية (لبن، بيض، مكسرات…)، واختاري حراق أو نباتي لو كده.',
        fr: 'Choisissez la catégorie, cochez les allergènes (lait, œufs, fruits à coque…) et « épicé » ou « végétarien » si c\'est le cas.',
      },
      {
        en: 'Add up to 4 photos, the best one first, then tap {saveDish}. It appears for customers right away.',
        ar: 'ضيفي لحد ٤ صور، أحلاهم الأول، ودوسي {saveDish}. هتظهر للزباين على طول.',
        fr: 'Ajoutez jusqu\'à 4 photos, la plus belle en premier, puis touchez {saveDish}. Le plat apparaît tout de suite.',
      },
    ],
    tip: {
      en: 'Take photos in daylight near a window, on a clean plate. Good photos get many more orders.',
      ar: 'صوّري في نور النهار جنب الشباك، في طبق نضيف. الصور الحلوة بتجيب طلبات أكتر بكتير.',
      fr: 'Photographiez à la lumière du jour près d\'une fenêtre, dans une assiette propre. De belles photos attirent beaucoup plus de commandes.',
    },
  },
  {
    id: 'menu',
    icon: 'restaurant-outline',
    title: { en: 'Manage your menu', ar: 'نظّمي المنيو', fr: 'Gérer votre menu' },
    steps: [
      {
        en: 'Switch a dish off when you can\'t cook it (no ingredients, holiday…). It disappears for customers until you switch it on.',
        ar: 'اقفلي الأكلة لما متقدريش تطبخيها (مفيش مكونات، أجازة…). هتختفي من عند الزباين لحد ما تفتحيها تاني.',
        fr: 'Désactivez un plat quand vous ne pouvez pas le préparer (ingrédients, vacances…). Il disparaît jusqu\'à ce que vous le réactiviez.',
      },
      {
        en: '{dailyLimit}: use − and + to set the most portions you can cook in one day. When they\'re sold, the dish shows {soldOutToday}.',
        ar: '{dailyLimit}: استخدمي − و + عشان تحددي أكتر عدد حصص تقدري تطبخيه في اليوم. لما يخلصوا الأكلة هتظهر {soldOutToday}.',
        fr: '{dailyLimit} : avec − et +, fixez le nombre maximum de portions par jour. Une fois vendues, le plat affiche {soldOutToday}.',
      },
      {
        en: 'Tap a dish photo to change or add photos. The bin deletes a dish (the app asks first).',
        ar: 'دوسي على صورة الأكلة عشان تغيّري أو تضيفي صور. سلة الزبالة بتمسح الأكلة (التطبيق بيسألك الأول).',
        fr: 'Touchez la photo d\'un plat pour la changer ou en ajouter. La corbeille supprime le plat (avec confirmation).',
      },
    ],
  },
  {
    id: 'pause',
    icon: 'pause-circle-outline',
    title: { en: 'Too busy? Pause orders', ar: 'مشغولة؟ وقّفي الطلبات', fr: 'Trop occupée ? Mettez en pause' },
    steps: [
      {
        en: 'In the {kitchenSettings} tab, turn off {kitchenTakingOrders}. Your kitchen stops getting new orders.',
        ar: 'من تاب {kitchenSettings}، اقفلي {kitchenTakingOrders}. مطبخك هيبطّل ياخد طلبات جديدة.',
        fr: 'Dans l\'onglet {kitchenSettings}, désactivez {kitchenTakingOrders}. Vous ne recevez plus de nouvelles commandes.',
      },
      {
        en: 'Orders you already have stay in the {kitchenOrders} tab, so finish them as usual.',
        ar: 'الطلبات اللي عندك بالفعل بتفضل في تاب {kitchenOrders}، فكمّليها عادي.',
        fr: 'Les commandes déjà reçues restent dans l\'onglet {kitchenOrders} : terminez-les normalement.',
      },
      {
        en: 'Turn it back on when you\'re ready. The {kitchenDashboard} always shows whether you\'re taking orders or paused.',
        ar: 'افتحيه تاني لما تكوني جاهزة. {kitchenDashboard} دايماً بتوضح إنتي بتستقبلي طلبات ولا واقفة.',
        fr: 'Réactivez-le quand vous êtes prête. L\'onglet {kitchenDashboard} indique toujours si vous êtes ouverte ou en pause.',
      },
    ],
  },
  {
    id: 'orders',
    icon: 'notifications-outline',
    title: { en: 'When a new order comes', ar: 'لما ييجي طلب جديد', fr: 'Quand une commande arrive' },
    steps: [
      {
        en: 'Your phone shows "New order! 🍲" and plays a sound. The {kitchenOrders} tab shows a red number.',
        ar: 'تليفونك هيظهر "طلب جديد! 🍲" ويعمل صوت، وتاب {kitchenOrders} هيبان عليه رقم أحمر.',
        fr: 'Votre téléphone affiche « Nouvelle commande ! 🍲 » avec un son. L\'onglet {kitchenOrders} montre un chiffre rouge.',
      },
      {
        en: 'Open the order and read: the dishes and how many, the delivery time, the customer\'s note and the address.',
        ar: 'افتحي الطلب واقري: الأكلات والعدد، وميعاد التوصيل، وملاحظة الزبون، والعنوان.',
        fr: 'Ouvrez la commande et lisez : les plats et quantités, l\'heure de livraison, la note du client et l\'adresse.',
      },
      {
        en: 'Answer quickly: customers wait for you to accept.',
        ar: 'ردّي بسرعة: الزبون مستني إنك تقبلي.',
        fr: 'Répondez vite : le client attend que vous acceptiez.',
      },
    ],
    tip: {
      en: 'Allow notifications for Kitchy\'s on your phone, or you won\'t hear new orders when the app is closed.',
      ar: 'اسمحي بالإشعارات لكيتشيز على تليفونك، وإلا مش هتعرفي بالطلبات الجديدة والتطبيق مقفول.',
      fr: 'Autorisez les notifications de Kitchy\'s sur votre téléphone, sinon vous ne serez pas prévenue quand l\'application est fermée.',
    },
  },
  {
    id: 'steps',
    icon: 'checkmark-done-outline',
    title: { en: 'Move the order along', ar: 'حرّكي الطلب خطوة خطوة', fr: 'Faire avancer la commande' },
    steps: [
      {
        en: 'Tap {acceptAndCook}. The customer is told you\'re cooking.',
        ar: 'دوسي {acceptAndCook}. الزبون هيعرف إنك بتطبخي.',
        fr: 'Touchez {acceptAndCook}. Le client est prévenu que vous cuisinez.',
      },
      {
        en: 'When the food leaves your kitchen, tap {sendOut}.',
        ar: 'لما الأكل يخرج من مطبخك، دوسي {sendOut}.',
        fr: 'Quand le plat quitte votre cuisine, touchez {sendOut}.',
      },
      {
        en: 'When it reaches the customer, tap {markDelivered}. The order moves to {pastOrders}.',
        ar: 'لما يوصل للزبون، دوسي {markDelivered}. الطلب هيروح لـ {pastOrders}.',
        fr: 'Quand il arrive chez le client, touchez {markDelivered}. La commande passe dans {pastOrders}.',
      },
      {
        en: 'Can\'t make it? Tap {declineOrder}. The customer is told, and any credit they used is returned.',
        ar: 'مش هتقدري؟ دوسي {declineOrder}. الزبون هيعرف، وأي رصيد استخدمه هيرجعله.',
        fr: 'Impossible ? Touchez {declineOrder}. Le client est prévenu et son crédit lui est rendu.',
      },
    ],
  },
  {
    id: 'reviews',
    icon: 'star-outline',
    title: { en: 'Reviews and replies', ar: 'التقييمات والردود', fr: 'Avis et réponses' },
    steps: [
      {
        en: 'Open the {kitchenReviews} tab to see your average for food, delivery, packaging and value, and every review.',
        ar: 'افتحي تاب {kitchenReviews} عشان تشوفي متوسطك في الأكل والتوصيل والتغليف والسعر، وكل التقييمات.',
        fr: 'Ouvrez l\'onglet {kitchenReviews} pour voir votre moyenne (plat, livraison, emballage, prix) et tous les avis.',
      },
      {
        en: 'Tap {reply} under a review, write a kind answer and tap {sendReply}. Customers see it on your page.',
        ar: 'دوسي {reply} تحت التقييم، اكتبي رد لطيف، ودوسي {sendReply}. الزباين هيشوفوه في صفحتك.',
        fr: 'Touchez {reply} sous un avis, écrivez une réponse aimable et touchez {sendReply}. Les clients la voient sur votre page.',
      },
    ],
    tip: {
      en: 'Thank people for good reviews, and for a bad one say what you\'ll do better. It builds trust.',
      ar: 'اشكري الناس على التقييم الحلو، ولو في تقييم وحش قولي هتعملي إيه أحسن. ده بيبني ثقة.',
      fr: 'Remerciez pour les bons avis et, pour un mauvais, dites ce que vous allez améliorer. Cela crée la confiance.',
    },
  },
  {
    id: 'dashboard',
    icon: 'stats-chart-outline',
    title: { en: 'Understand your numbers', ar: 'افهمي أرقامك', fr: 'Comprendre vos chiffres' },
    steps: [
      {
        en: 'Today: how many orders and how much you sold today, and how many orders are still in progress.',
        ar: 'النهارده: كام طلب وبعتي بكام النهارده، وكام طلب لسه شغالة عليه.',
        fr: 'Aujourd\'hui : nombre de commandes, ventes du jour et commandes encore en cours.',
      },
      {
        en: 'Pick 7, 30 or 90 days to see orders, sales, average order and customers. Green +% means better than the period before.',
        ar: 'اختاري ٧ أو ٣٠ أو ٩٠ يوم عشان تشوفي الطلبات والمبيعات ومتوسط الطلب والزباين. الـ +٪ الأخضر يعني أحسن من الفترة اللي قبلها.',
        fr: 'Choisissez 7, 30 ou 90 jours pour voir commandes, ventes, panier moyen et clients. Un +% vert signifie mieux que la période précédente.',
      },
      {
        en: 'The charts show your sales by day and your busiest days. Tap a bar to read its number.',
        ar: 'الرسومات بتوضح مبيعاتك كل يوم وأكتر الأيام عليها طلبات. دوسي على أي عمود عشان تشوفي رقمه.',
        fr: 'Les graphiques montrent vos ventes par jour et vos jours les plus chargés. Touchez une barre pour lire son chiffre.',
      },
      {
        en: '"Best-selling dishes" shows what customers love most, so you can cook more of it.',
        ar: '"الأكلات الأكتر مبيعاً" بتوضح الزباين بيحبوا إيه أكتر، عشان تطبخي منه أكتر.',
        fr: '« Plats les plus vendus » montre ce que les clients préfèrent, pour en cuisiner davantage.',
      },
    ],
  },
  {
    id: 'email',
    icon: 'mail-outline',
    title: { en: 'Your weekly email', ar: 'إيميلك الأسبوعي', fr: 'Votre e-mail hebdomadaire' },
    steps: [
      {
        en: 'Every Sunday morning we email you last week\'s orders, sales, best dish, busiest day and rating, with tips.',
        ar: 'كل يوم حد الصبح بنبعتلك إيميل فيه طلبات الأسبوع اللي فات والمبيعات وأحسن أكلة وأكتر يوم ضغط وتقييمك، مع نصايح.',
        fr: 'Chaque dimanche matin, nous vous envoyons les commandes, ventes, meilleur plat, jour le plus chargé et note de la semaine, avec des conseils.',
      },
      {
        en: 'It goes to the email you signed up with. Check your spam folder if you can\'t find it.',
        ar: 'بيوصل على الإيميل اللي سجلتي بيه. بصّي في السبام لو مش لاقياه.',
        fr: 'Il arrive à l\'adresse de votre compte. Regardez dans les spams si vous ne le trouvez pas.',
      },
    ],
  },
  {
    id: 'tips',
    icon: 'heart-outline',
    title: { en: 'Tips for happy customers', ar: 'نصايح عشان الزباين تنبسط', fr: 'Conseils pour des clients ravis' },
    steps: [
      {
        en: 'Cook with clean hands and a clean kitchen, and keep food covered.',
        ar: 'اطبخي بإيد نضيفة ومطبخ نضيف، وخلّي الأكل متغطي.',
        fr: 'Cuisinez les mains et la cuisine propres, et gardez les plats couverts.',
      },
      {
        en: 'Pack food in sealed containers that don\'t leak, and add a napkin and spoon if needed.',
        ar: 'غلّفي الأكل في علب مقفولة كويس متسرّبش، وحطي منديل ومعلقة لو محتاج.',
        fr: 'Emballez dans des boîtes bien fermées qui ne fuient pas, avec serviette et cuillère si besoin.',
      },
      {
        en: 'Be on time. If you\'re running late, it\'s better to decline early than to keep a customer waiting.',
        ar: 'خليكي في الميعاد. لو هتتأخري، أحسن ترفضي بدري من إنك تخلي الزبون مستني.',
        fr: 'Soyez à l\'heure. En cas de retard, mieux vaut refuser tôt que faire attendre le client.',
      },
      {
        en: 'Follow the customer\'s note ("less salt", "no onions") and write the allergens honestly.',
        ar: 'اتّبعي ملاحظة الزبون ("ملح أقل"، "من غير بصل") واكتبي مسببات الحساسية بأمانة.',
        fr: 'Respectez la note du client (« moins de sel », « sans oignons ») et indiquez honnêtement les allergènes.',
      },
    ],
  },
];

export const HELP: Record<HelpAudience, HelpTopic[]> = { customer: CUSTOMER_HELP, chef: CHEF_HELP };
