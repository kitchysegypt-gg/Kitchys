import type { EmojiName } from '@/lib/emoji';
import type { Localized } from '@/lib/i18n';

export type Allergen = 'gluten' | 'dairy' | 'eggs' | 'nuts' | 'peanuts' | 'fish' | 'shellfish' | 'soy' | 'sesame';

export const ALLERGEN_EMOJI: Record<Allergen, EmojiName> = {
  gluten: 'wheat',
  dairy: 'milk',
  eggs: 'egg',
  nuts: 'nuts',
  peanuts: 'peanuts',
  fish: 'fish',
  shellfish: 'shrimp',
  soy: 'beans',
  sesame: 'seedling',
};

export type Category = 'main' | 'baked' | 'seafood' | 'desserts' | 'drinks' | 'healthy';

export const CATEGORIES: {
  id: Category | 'all';
  emoji: EmojiName;
  label: 'catAll' | 'catMain' | 'catBaked' | 'catSeafood' | 'catDesserts' | 'catDrinks' | 'catHealthy';
}[] = [
  { id: 'all', emoji: 'sparkles', label: 'catAll' },
  { id: 'main', emoji: 'pot', label: 'catMain' },
  { id: 'baked', emoji: 'flatbread', label: 'catBaked' },
  { id: 'seafood', emoji: 'shrimp', label: 'catSeafood' },
  { id: 'desserts', emoji: 'cake', label: 'catDesserts' },
  { id: 'drinks', emoji: 'tropical_drink', label: 'catDrinks' },
  { id: 'healthy', emoji: 'salad', label: 'catHealthy' },
];

export type Chef = {
  id: string;
  name: Localized;
  emoji: EmojiName;
  area: Localized;
  specialty: Localized;
  bio: Localized;
  rating: number;
  color: string;
};

export type Dish = {
  id: string;
  chefId: string;
  category: Category;
  emoji: EmojiName;
  name: Localized;
  short: Localized;
  description: Localized;
  ingredients: Localized;
  allergens: Allergen[];
  price: number;
  prepMinutes: number;
  serves: number;
  spicy?: boolean;
  vegetarian?: boolean;
  popular?: boolean;
};

export const CHEFS: Chef[] = [
  {
    id: 'fatma',
    name: { en: 'Mama Fatma', ar: 'ماما فاطمة', fr: 'Maman Fatma' },
    emoji: 'chef_1',
    area: { en: 'Shubra, Cairo', ar: 'شبرا، القاهرة', fr: 'Choubra, Le Caire' },
    specialty: { en: 'Egyptian classics', ar: 'أكلات مصرية أصيلة', fr: 'Classiques égyptiens' },
    bio: {
      en: 'Cooking for her family of seven for 30 years. Her molokhia is famous on the whole street.',
      ar: 'بتطبخ لعيلتها المكونة من ٧ أفراد من ٣٠ سنة. ملوخيتها مشهورة في الشارع كله.',
      fr: 'Elle cuisine pour sa famille de sept depuis 30 ans. Sa mouloukhiya est célèbre dans toute la rue.',
    },
    rating: 4.9,
    color: '#FFE3D3',
  },
  {
    id: 'samira',
    name: { en: 'Teta Samira', ar: 'تيتا سميرة', fr: 'Teta Samira' },
    emoji: 'grandma_1',
    area: { en: 'Anfoushi, Alexandria', ar: 'الأنفوشي، الإسكندرية', fr: 'Anfouchi, Alexandrie' },
    specialty: { en: 'Alexandrian seafood', ar: 'مأكولات بحرية سكندري', fr: 'Fruits de mer d’Alexandrie' },
    bio: {
      en: "A fisherman's daughter who buys the catch fresh every morning from the Anfoushi harbour.",
      ar: 'بنت صياد، بتشتري السمك طازة كل يوم الصبح من مينا الأنفوشي.',
      fr: 'Fille de pêcheur, elle achète le poisson frais chaque matin au port d’Anfouchi.',
    },
    rating: 4.8,
    color: '#D9F0FF',
  },
  {
    id: 'mona',
    name: { en: 'Om Karim (Mona)', ar: 'أم كريم (منى)', fr: 'Om Karim (Mona)' },
    emoji: 'chef_2',
    area: { en: 'Nasr City, Cairo', ar: 'مدينة نصر، القاهرة', fr: 'Nasr City, Le Caire' },
    specialty: { en: 'Oven-baked favourites', ar: 'أكلات الفرن', fr: 'Plats au four' },
    bio: {
      en: 'Her wood-style oven turns out the flakiest feteer and the creamiest béchamel in Nasr City.',
      ar: 'فرنها بيطلع أطرى فطير وأغنى مكرونة بشاميل في مدينة نصر.',
      fr: 'Son four sort le feteer le plus feuilleté et la béchamel la plus crémeuse de Nasr City.',
    },
    rating: 4.7,
    color: '#FFF1C7',
  },
  {
    id: 'hoda',
    name: { en: 'Nana Hoda', ar: 'نانا هدى', fr: 'Nana Hoda' },
    emoji: 'grandma_2',
    area: { en: 'Heliopolis, Cairo', ar: 'مصر الجديدة، القاهرة', fr: 'Héliopolis, Le Caire' },
    specialty: { en: 'Desserts & drinks', ar: 'حلويات ومشروبات', fr: 'Desserts et boissons' },
    bio: {
      en: 'Grandmother of eleven and the reason every family gathering ends with something sweet.',
      ar: 'جدة لـ ١١ حفيد، وهي السبب إن كل لمة عيلة بتخلص بحاجة حلوة.',
      fr: 'Grand-mère de onze petits-enfants, c’est grâce à elle que chaque fête finit en douceur.',
    },
    rating: 5.0,
    color: '#FFE0EC',
  },
  {
    id: 'nour',
    name: { en: 'Mama Nour', ar: 'ماما نور', fr: 'Maman Nour' },
    emoji: 'chef_3',
    area: { en: 'Maadi, Cairo', ar: 'المعادي، القاهرة', fr: 'Maadi, Le Caire' },
    specialty: { en: 'Healthy & grilled', ar: 'صحي ومشويات', fr: 'Healthy et grillades' },
    bio: {
      en: 'A nutritionist and mother of three who makes light, fresh food that still tastes like home.',
      ar: 'أخصائية تغذية وأم لـ ٣ أطفال، بتعمل أكل خفيف وطازة وطعمه بيتي.',
      fr: 'Nutritionniste et mère de trois enfants, elle prépare une cuisine légère au goût de la maison.',
    },
    rating: 4.8,
    color: '#DDF5EA',
  },
];

export const DISHES: Dish[] = [
  // ——— Mama Fatma ———
  {
    id: 'koshari',
    chefId: 'fatma',
    category: 'main',
    emoji: 'steaming_bowl',
    name: { en: 'Koshari', ar: 'كشري', fr: 'Koshari' },
    short: {
      en: 'Rice, lentils & pasta with tangy tomato sauce',
      ar: 'رز وعدس ومكرونة بصلصة الطماطم',
      fr: 'Riz, lentilles et pâtes, sauce tomate',
    },
    description: {
      en: "Egypt's favourite comfort food: layers of rice, brown lentils, macaroni and chickpeas, topped with a garlicky vinegar tomato sauce and a mountain of crispy fried onions. Hot sauce comes on the side.",
      ar: 'أكلة مصر المفضلة: طبقات من الرز والعدس بجبة والمكرونة والحمص، مع صلصة طماطم بالخل والتوم وكمية كبيرة من البصل المقرمش. الشطة جنب الطبق.',
      fr: 'Le plat réconfort préféré de l’Égypte : riz, lentilles, macaronis et pois chiches, nappés d’une sauce tomate à l’ail et au vinaigre et d’oignons frits croustillants. Sauce piquante à part.',
    },
    ingredients: {
      en: 'Rice, brown lentils, macaroni (wheat), chickpeas, tomatoes, garlic, vinegar, onions, sunflower oil, cumin, chilli',
      ar: 'رز، عدس بجبة، مكرونة (قمح)، حمص، طماطم، توم، خل، بصل، زيت عباد الشمس، كمون، شطة',
      fr: 'Riz, lentilles, macaronis (blé), pois chiches, tomates, ail, vinaigre, oignons, huile de tournesol, cumin, piment',
    },
    allergens: ['gluten'],
    price: 85,
    prepMinutes: 25,
    serves: 1,
    vegetarian: true,
    popular: true,
  },
  {
    id: 'molokhia',
    chefId: 'fatma',
    category: 'main',
    emoji: 'pot',
    name: { en: 'Molokhia with Chicken', ar: 'ملوخية بالفراخ', fr: 'Mouloukhiya au poulet' },
    short: {
      en: 'Silky jute-leaf stew with half a roast chicken',
      ar: 'ملوخية خضرا مع نص فرخة محمرة',
      fr: 'Ragoût de corète et demi-poulet rôti',
    },
    description: {
      en: 'Finely minced jute leaves simmered in homemade chicken broth and finished with the famous "tasha" of garlic and coriander fried in ghee. Served with half a golden roast chicken and white vermicelli rice.',
      ar: 'ملوخية مخروطة ناعم متسبكة في شوربة فراخ بيتي، ومعاها التقلية الشهيرة بالتوم والكزبرة في السمنة. بتتقدم مع نص فرخة محمرة ورز بالشعرية.',
      fr: 'Feuilles de corète finement hachées mijotées dans un bouillon de poulet maison, finies avec la fameuse « tasha » d’ail et coriandre frits au ghee. Servie avec un demi-poulet rôti et du riz aux vermicelles.',
    },
    ingredients: {
      en: 'Jute leaves, chicken, chicken broth, garlic, coriander, ghee (butter), rice, vermicelli (wheat), cardamom, bay leaf',
      ar: 'ملوخية، فراخ، شوربة فراخ، توم، كزبرة، سمنة (زبدة)، رز، شعرية (قمح)، حبهان، ورق لورا',
      fr: 'Corète, poulet, bouillon de poulet, ail, coriandre, ghee (beurre), riz, vermicelles (blé), cardamome, laurier',
    },
    allergens: ['gluten', 'dairy'],
    price: 180,
    prepMinutes: 40,
    serves: 2,
    popular: true,
  },
  {
    id: 'mahshi',
    chefId: 'fatma',
    category: 'main',
    emoji: 'bell_pepper',
    name: { en: 'Mixed Mahshi', ar: 'محشي مشكل', fr: 'Mahshi mixte' },
    short: {
      en: 'Stuffed peppers, zucchini, eggplant & vine leaves',
      ar: 'فلفل وكوسة وباذنجان وورق عنب محشي',
      fr: 'Poivrons, courgettes, aubergines et feuilles de vigne farcis',
    },
    description: {
      en: 'A family-size tray of vegetables hand-stuffed with herby rice seasoned with tomato, dill, parsley and mint, then slow-cooked in a light tomato broth. Every piece is rolled by hand.',
      ar: 'صينية عائلية من الخضار المحشي باليد برز متتبل بالطماطم والشبت والبقدونس والنعناع، ومتسبك على نار هادية في صلصة طماطم خفيفة. كل صباع ملفوف باليد.',
      fr: 'Un grand plat de légumes farcis à la main de riz aux herbes (tomate, aneth, persil, menthe), mijotés dans un léger bouillon de tomate. Chaque pièce est roulée à la main.',
    },
    ingredients: {
      en: 'Rice, bell peppers, zucchini, eggplant, vine leaves, tomatoes, onions, dill, parsley, mint, olive oil, lemon',
      ar: 'رز، فلفل رومي، كوسة، باذنجان، ورق عنب، طماطم، بصل، شبت، بقدونس، نعناع، زيت زيتون، ليمون',
      fr: 'Riz, poivrons, courgettes, aubergines, feuilles de vigne, tomates, oignons, aneth, persil, menthe, huile d’olive, citron',
    },
    allergens: [],
    price: 220,
    prepMinutes: 45,
    serves: 3,
    vegetarian: true,
  },
  {
    id: 'fatta',
    chefId: 'fatma',
    category: 'main',
    emoji: 'pan',
    name: { en: 'Beef Fatta', ar: 'فتة باللحمة', fr: 'Fatta au bœuf' },
    short: {
      en: 'Crispy bread, rice and tender beef with garlic vinegar sauce',
      ar: 'عيش محمص ورز ولحمة طرية بصلصة الخل والتوم',
      fr: 'Pain croustillant, riz et bœuf fondant, sauce ail-vinaigre',
    },
    description: {
      en: 'The celebration dish of Eid: layers of toasted baladi bread soaked in beef broth, fluffy rice, and slow-cooked beef chunks, all covered with a tangy garlic-vinegar tomato sauce.',
      ar: 'طبق العيد: طبقات من العيش البلدي المحمص مغموس في شوربة اللحمة، رز منفوش، وقطع لحمة مطبوخة على نار هادية، وعليها صلصة طماطم بالخل والتوم.',
      fr: 'Le plat de fête de l’Aïd : pain baladi grillé imbibé de bouillon, riz moelleux et morceaux de bœuf mijotés, nappés d’une sauce tomate à l’ail et au vinaigre.',
    },
    ingredients: {
      en: 'Beef, baladi bread (wheat), rice, beef broth, garlic, vinegar, tomatoes, ghee (butter)',
      ar: 'لحم بقري، عيش بلدي (قمح)، رز، شوربة لحمة، توم، خل، طماطم، سمنة (زبدة)',
      fr: 'Bœuf, pain baladi (blé), riz, bouillon de bœuf, ail, vinaigre, tomates, ghee (beurre)',
    },
    allergens: ['gluten', 'dairy'],
    price: 240,
    prepMinutes: 50,
    serves: 2,
  },

  // ——— Teta Samira ———
  {
    id: 'sayadeya',
    chefId: 'samira',
    category: 'seafood',
    emoji: 'fish',
    name: { en: 'Sayadeya Fish', ar: 'صيادية سمك', fr: 'Poisson sayadeya' },
    short: {
      en: 'Spiced fish over caramelised-onion brown rice',
      ar: 'سمك متبل على رز بني بالبصل المكرمل',
      fr: 'Poisson épicé sur riz aux oignons caramélisés',
    },
    description: {
      en: 'The Alexandrian classic: fresh white fish fillets baked with cumin and lemon, served on rice cooked in a deep brown caramelised-onion fish stock. Topped with toasted pine nuts.',
      ar: 'الكلاسيكية السكندري: فيليه سمك أبيض طازة متسوي في الفرن بالكمون والليمون، على رز مطبوخ في شوربة سمك بالبصل المكرمل. ومزين بالصنوبر المحمص.',
      fr: 'Le classique d’Alexandrie : filets de poisson blanc au four, cumin et citron, sur un riz cuit dans un fumet aux oignons caramélisés. Garni de pignons grillés.',
    },
    ingredients: {
      en: 'White fish, rice, onions, fish stock, cumin, lemon, garlic, pine nuts, olive oil',
      ar: 'سمك أبيض، رز، بصل، شوربة سمك، كمون، ليمون، توم، صنوبر، زيت زيتون',
      fr: 'Poisson blanc, riz, oignons, fumet de poisson, cumin, citron, ail, pignons, huile d’olive',
    },
    allergens: ['fish', 'nuts'],
    price: 260,
    prepMinutes: 40,
    serves: 1,
    popular: true,
  },
  {
    id: 'shrimp',
    chefId: 'samira',
    category: 'seafood',
    emoji: 'shrimp',
    name: { en: 'Crispy Fried Shrimp', ar: 'جمبري مقلي مقرمش', fr: 'Crevettes frites croustillantes' },
    short: {
      en: 'Golden breaded shrimp with tahini dip',
      ar: 'جمبري بالبقسماط مع طحينة',
      fr: 'Crevettes panées, sauce tahini',
    },
    description: {
      en: 'Large Mediterranean shrimp, marinated in garlic and lemon, coated in crunchy breadcrumbs and fried until golden. Served with homemade tahini sauce and a lemon wedge.',
      ar: 'جمبري كبير من البحر المتوسط، متتبل بالتوم والليمون، ومتغطي بالبقسماط المقرمش ومقلي لحد ما يدهب. بيتقدم مع طحينة بيتي وحتة ليمون.',
      fr: 'Grosses crevettes de Méditerranée marinées à l’ail et au citron, panées et frites jusqu’à dorer. Servies avec une sauce tahini maison et du citron.',
    },
    ingredients: {
      en: 'Shrimp, breadcrumbs (wheat), eggs, garlic, lemon, sunflower oil, tahini (sesame), cumin',
      ar: 'جمبري، بقسماط (قمح)، بيض، توم، ليمون، زيت عباد الشمس، طحينة (سمسم)، كمون',
      fr: 'Crevettes, chapelure (blé), œufs, ail, citron, huile de tournesol, tahini (sésame), cumin',
    },
    allergens: ['shellfish', 'gluten', 'eggs', 'sesame'],
    price: 320,
    prepMinutes: 25,
    serves: 1,
  },
  {
    id: 'lentil-soup',
    chefId: 'samira',
    category: 'healthy',
    emoji: 'bowl_spoon',
    name: { en: 'Yellow Lentil Soup', ar: 'شوربة عدس أصفر', fr: 'Soupe de lentilles jaunes' },
    short: {
      en: 'Velvety lentil soup with cumin and lemon',
      ar: 'شوربة عدس ناعمة بالكمون والليمون',
      fr: 'Velouté de lentilles au cumin et citron',
    },
    description: {
      en: 'Winter in a bowl: yellow lentils slowly cooked with carrot, onion and tomato, blended silky smooth and seasoned with cumin. Comes with lemon and a bag of crispy toasted bread.',
      ar: 'الشتا في طبق: عدس أصفر مطبوخ على نار هادية مع الجزر والبصل والطماطم، متضرب ناعم ومتتبل بالكمون. معاه ليمون وكيس عيش محمص.',
      fr: 'L’hiver dans un bol : lentilles jaunes mijotées avec carotte, oignon et tomate, mixées et relevées au cumin. Avec du citron et des croûtons.',
    },
    ingredients: {
      en: 'Yellow lentils, carrots, onions, tomatoes, cumin, vegetable broth, lemon, toasted bread (wheat)',
      ar: 'عدس أصفر، جزر، بصل، طماطم، كمون، شوربة خضار، ليمون، عيش محمص (قمح)',
      fr: 'Lentilles jaunes, carottes, oignons, tomates, cumin, bouillon de légumes, citron, croûtons (blé)',
    },
    allergens: ['gluten'],
    price: 60,
    prepMinutes: 15,
    serves: 1,
    vegetarian: true,
  },
  {
    id: 'calamari',
    chefId: 'samira',
    category: 'seafood',
    emoji: 'rice_ball',
    name: { en: 'Seafood Rice Tagine', ar: 'طاجن رز بالسي فود', fr: 'Tajine de riz aux fruits de mer' },
    short: {
      en: 'Shrimp, calamari & fish baked with spiced rice',
      ar: 'جمبري وكاليماري وسمك في الفرن مع رز متبل',
      fr: 'Crevettes, calamars et poisson au four avec riz épicé',
    },
    description: {
      en: 'A clay-pot tagine of shrimp, calamari rings and fish pieces baked with red rice, tomato, peppers and Alexandrian spices until the top turns crispy. Mildly spicy.',
      ar: 'طاجن فخار فيه جمبري وحلقات كاليماري وقطع سمك، متسوي في الفرن مع رز أحمر وطماطم وفلفل وتوابل سكندري لحد ما الوش يقرمش. حار شوية.',
      fr: 'Un tajine en terre cuite de crevettes, calamars et poisson, cuit au four avec du riz rouge, tomates, poivrons et épices d’Alexandrie. Légèrement épicé.',
    },
    ingredients: {
      en: 'Shrimp, calamari, white fish, rice, tomatoes, bell peppers, onions, garlic, chilli, cumin, olive oil',
      ar: 'جمبري، كاليماري، سمك أبيض، رز، طماطم، فلفل رومي، بصل، توم، شطة، كمون، زيت زيتون',
      fr: 'Crevettes, calamars, poisson blanc, riz, tomates, poivrons, oignons, ail, piment, cumin, huile d’olive',
    },
    allergens: ['shellfish', 'fish'],
    price: 350,
    prepMinutes: 45,
    serves: 2,
    spicy: true,
  },

  // ——— Om Karim ———
  {
    id: 'feteer',
    chefId: 'mona',
    category: 'baked',
    emoji: 'flatbread',
    name: { en: 'Feteer Meshaltet', ar: 'فطير مشلتت', fr: 'Feteer meshaltet' },
    short: {
      en: 'Flaky buttery pastry with honey & old cheese',
      ar: 'فطير بالسمنة مع عسل وجبنة قديمة',
      fr: 'Feuilleté au beurre, miel et vieux fromage',
    },
    description: {
      en: 'Dozens of paper-thin layers of dough brushed with ghee and baked until golden and flaky. Comes with honey, molasses and tahini, and a piece of salty aged "mish" cheese.',
      ar: 'عشرات الطبقات الرقيقة من العجين مدهونة بالسمنة ومخبوزة لحد ما تدهب وتقرمش. معاها عسل أبيض وعسل أسود بالطحينة، وحتة جبنة قديمة.',
      fr: 'Des dizaines de couches de pâte ultra-fines badigeonnées de ghee et cuites jusqu’à être dorées. Avec miel, mélasse, tahini et un morceau de fromage vieilli « mish ».',
    },
    ingredients: {
      en: 'Wheat flour, ghee (butter), honey, molasses, tahini (sesame), aged cheese (milk), salt',
      ar: 'دقيق قمح، سمنة (زبدة)، عسل أبيض، عسل أسود، طحينة (سمسم)، جبنة قديمة (لبن)، ملح',
      fr: 'Farine de blé, ghee (beurre), miel, mélasse, tahini (sésame), fromage vieilli (lait), sel',
    },
    allergens: ['gluten', 'dairy', 'sesame'],
    price: 150,
    prepMinutes: 35,
    serves: 2,
    vegetarian: true,
    popular: true,
  },
  {
    id: 'hawawshi',
    chefId: 'mona',
    category: 'baked',
    emoji: 'stuffed_flatbread',
    name: { en: 'Hawawshi', ar: 'حواوشي', fr: 'Hawawshi' },
    short: {
      en: 'Baladi bread stuffed with spiced minced beef',
      ar: 'عيش بلدي محشي لحمة مفرومة متبلة',
      fr: 'Pain baladi farci de bœuf haché épicé',
    },
    description: {
      en: 'Baladi bread stuffed with minced beef mixed with onions, peppers, parsley and a secret spice blend, then baked until the bread is crackling crisp. Served with pickles and tahini.',
      ar: 'عيش بلدي محشي لحمة مفرومة مع بصل وفلفل وبقدونس وخلطة توابل سرية، ومخبوز لحد ما العيش يقرمش. بيتقدم مع مخلل وطحينة.',
      fr: 'Pain baladi farci de bœuf haché aux oignons, poivrons, persil et mélange d’épices secret, cuit jusqu’à être bien croustillant. Avec pickles et tahini.',
    },
    ingredients: {
      en: 'Minced beef, baladi bread (wheat), onions, bell peppers, parsley, chilli, spices, tahini (sesame)',
      ar: 'لحمة مفرومة، عيش بلدي (قمح)، بصل، فلفل رومي، بقدونس، شطة، توابل، طحينة (سمسم)',
      fr: 'Bœuf haché, pain baladi (blé), oignons, poivrons, persil, piment, épices, tahini (sésame)',
    },
    allergens: ['gluten', 'sesame'],
    price: 120,
    prepMinutes: 25,
    serves: 1,
    spicy: true,
  },
  {
    id: 'bechamel',
    chefId: 'mona',
    category: 'baked',
    emoji: 'spaghetti',
    name: { en: 'Macaroni Béchamel', ar: 'مكرونة بشاميل', fr: 'Macaronis béchamel' },
    short: {
      en: 'Baked pasta with minced meat and creamy béchamel',
      ar: 'مكرونة في الفرن باللحمة المفرومة والبشاميل',
      fr: 'Gratin de pâtes à la viande et béchamel',
    },
    description: {
      en: 'Penne layered with tomato-simmered minced beef and a thick, creamy béchamel, baked until the top is golden brown. The Sunday lunch every Egyptian grew up with.',
      ar: 'مكرونة قلم متطبقة مع لحمة مفرومة متسبكة بالطماطم وبشاميل كريمي تقيل، ومخبوزة لحد ما الوش يحمر. غدا يوم الجمعة اللي كلنا اتربينا عليه.',
      fr: 'Penne en couches avec du bœuf haché mijoté à la tomate et une béchamel épaisse, gratinées au four. Le déjeuner du dimanche de tous les Égyptiens.',
    },
    ingredients: {
      en: 'Penne pasta (wheat), minced beef, tomatoes, onions, milk, butter, wheat flour, eggs, nutmeg',
      ar: 'مكرونة قلم (قمح)، لحمة مفرومة، طماطم، بصل، لبن، زبدة، دقيق، بيض، جوزة الطيب',
      fr: 'Penne (blé), bœuf haché, tomates, oignons, lait, beurre, farine, œufs, noix de muscade',
    },
    allergens: ['gluten', 'dairy', 'eggs'],
    price: 190,
    prepMinutes: 40,
    serves: 3,
    popular: true,
  },
  {
    id: 'moussaka',
    chefId: 'mona',
    category: 'main',
    emoji: 'eggplant',
    name: { en: 'Egyptian Moussaka', ar: 'مسقعة', fr: 'Moussaka égyptienne' },
    short: {
      en: 'Fried eggplant baked in garlicky tomato sauce',
      ar: 'باذنجان مقلي في صلصة طماطم بالتوم',
      fr: 'Aubergines frites au four, sauce tomate à l’ail',
    },
    description: {
      en: 'Slices of fried eggplant and green peppers baked in a rich tomato, garlic and vinegar sauce. Fully plant-based and even better the next day. Served with baladi bread.',
      ar: 'شرايح باذنجان وفلفل أخضر مقلي، متسوي في الفرن في صلصة طماطم غنية بالتوم والخل. نباتي تماماً وبيبقى أحلى تاني يوم. بيتقدم مع عيش بلدي.',
      fr: 'Tranches d’aubergine et de poivron frits, cuites dans une sauce tomate riche à l’ail et au vinaigre. 100 % végétal, encore meilleur le lendemain. Servi avec du pain baladi.',
    },
    ingredients: {
      en: 'Eggplant, green peppers, tomatoes, garlic, vinegar, chilli, sunflower oil, baladi bread (wheat)',
      ar: 'باذنجان، فلفل أخضر، طماطم، توم، خل، شطة، زيت عباد الشمس، عيش بلدي (قمح)',
      fr: 'Aubergines, poivrons verts, tomates, ail, vinaigre, piment, huile de tournesol, pain baladi (blé)',
    },
    allergens: ['gluten'],
    price: 110,
    prepMinutes: 30,
    serves: 2,
    vegetarian: true,
    spicy: true,
  },

  // ——— Nana Hoda ———
  {
    id: 'om-ali',
    chefId: 'hoda',
    category: 'desserts',
    emoji: 'custard',
    name: { en: 'Om Ali', ar: 'أم علي', fr: 'Om Ali' },
    short: {
      en: 'Warm pastry pudding with milk, nuts & coconut',
      ar: 'رقاق باللبن والمكسرات وجوز الهند',
      fr: 'Pudding de pâte feuilletée au lait et fruits secs',
    },
    description: {
      en: "Egypt's most loved dessert: crispy puff pastry soaked in sweet hot milk and cream, loaded with raisins, coconut, almonds, hazelnuts and pistachios, then baked until bubbling.",
      ar: 'أشهر حلو في مصر: رقاق مقرمش متغرق في لبن وقشطة سخنين، ومليان زبيب وجوز هند ولوز وبندق وفستق، ومتسوي في الفرن لحد ما يغلي.',
      fr: 'Le dessert préféré des Égyptiens : feuilleté croustillant imbibé de lait chaud sucré et de crème, avec raisins secs, coco, amandes, noisettes et pistaches, gratiné au four.',
    },
    ingredients: {
      en: 'Puff pastry (wheat, butter), milk, cream, sugar, raisins, coconut, almonds, hazelnuts, pistachios',
      ar: 'رقاق (قمح، زبدة)، لبن، قشطة، سكر، زبيب، جوز هند، لوز، بندق، فستق',
      fr: 'Pâte feuilletée (blé, beurre), lait, crème, sucre, raisins secs, noix de coco, amandes, noisettes, pistaches',
    },
    allergens: ['gluten', 'dairy', 'nuts'],
    price: 90,
    prepMinutes: 25,
    serves: 1,
    vegetarian: true,
    popular: true,
  },
  {
    id: 'basbousa',
    chefId: 'hoda',
    category: 'desserts',
    emoji: 'cake',
    name: { en: 'Basbousa', ar: 'بسبوسة', fr: 'Basboussa' },
    short: {
      en: 'Semolina cake soaked in rose syrup',
      ar: 'بسبوسة بالسميد والشربات',
      fr: 'Gâteau de semoule au sirop de rose',
    },
    description: {
      en: 'Soft, golden semolina cake made with yoghurt and coconut, soaked in rose-scented sugar syrup and topped with a whole almond on every piece. Box of 8 pieces.',
      ar: 'بسبوسة طرية دهبي بالسميد والزبادي وجوز الهند، متغرقة في شربات بماء الورد وعلى كل حتة لوزة. علبة ٨ قطع.',
      fr: 'Gâteau de semoule moelleux au yaourt et à la noix de coco, imbibé de sirop à la rose, une amande sur chaque part. Boîte de 8 parts.',
    },
    ingredients: {
      en: 'Semolina (wheat), yoghurt (milk), butter, coconut, sugar, rose water, almonds',
      ar: 'سميد (قمح)، زبادي (لبن)، زبدة، جوز هند، سكر، ماء ورد، لوز',
      fr: 'Semoule (blé), yaourt (lait), beurre, noix de coco, sucre, eau de rose, amandes',
    },
    allergens: ['gluten', 'dairy', 'nuts'],
    price: 120,
    prepMinutes: 10,
    serves: 4,
    vegetarian: true,
  },
  {
    id: 'roz-bel-laban',
    chefId: 'hoda',
    category: 'desserts',
    emoji: 'milk',
    name: { en: 'Roz bel Laban', ar: 'رز بلبن', fr: 'Riz au lait' },
    short: {
      en: 'Creamy rice pudding with cinnamon',
      ar: 'رز بلبن كريمي بالقرفة',
      fr: 'Riz au lait crémeux à la cannelle',
    },
    description: {
      en: 'Short-grain rice slowly cooked in full-cream milk with a hint of vanilla and mastic, chilled and dusted with cinnamon. Available plain or baked with a caramelised top.',
      ar: 'رز مصري متطبخ على نار هادية في لبن كامل الدسم مع فانيليا ومستكة، متبرد ومرشوش عليه قرفة. متاح عادي أو في الفرن بوش مكرمل.',
      fr: 'Riz rond cuit lentement dans du lait entier avec une touche de vanille et de mastic, servi frais avec de la cannelle. Nature ou gratiné au four.',
    },
    ingredients: {
      en: 'Rice, full-cream milk, sugar, vanilla, mastic, cinnamon, cornstarch',
      ar: 'رز، لبن كامل الدسم، سكر، فانيليا، مستكة، قرفة، نشا',
      fr: 'Riz, lait entier, sucre, vanille, mastic, cannelle, fécule de maïs',
    },
    allergens: ['dairy'],
    price: 55,
    prepMinutes: 10,
    serves: 1,
    vegetarian: true,
  },
  {
    id: 'konafa',
    chefId: 'hoda',
    category: 'desserts',
    emoji: 'pie',
    name: { en: 'Cream Konafa', ar: 'كنافة بالقشطة', fr: 'Konafa à la crème' },
    short: {
      en: 'Crispy shredded pastry with fresh cream filling',
      ar: 'كنافة مقرمشة محشية قشطة',
      fr: 'Cheveux d’ange croustillants fourrés à la crème',
    },
    description: {
      en: 'Golden, buttery shredded kataifi pastry baked around a thick layer of fresh cream (ashta), drenched in cold syrup and sprinkled with crushed pistachios.',
      ar: 'كنافة دهبي بالسمنة متخبوزة حوالين طبقة تقيلة من القشطة الفريش، متغرقة في شربات بارد ومرشوش عليها فستق مجروش.',
      fr: 'Pâte kataïf dorée au beurre, cuite autour d’une épaisse couche de crème fraîche (achta), arrosée de sirop froid et parsemée de pistaches concassées.',
    },
    ingredients: {
      en: 'Kataifi pastry (wheat), ghee (butter), fresh cream (milk), sugar, lemon, pistachios',
      ar: 'كنافة (قمح)، سمنة (زبدة)، قشطة (لبن)، سكر، ليمون، فستق',
      fr: 'Pâte kataïf (blé), ghee (beurre), crème fraîche (lait), sucre, citron, pistaches',
    },
    allergens: ['gluten', 'dairy', 'nuts'],
    price: 140,
    prepMinutes: 30,
    serves: 3,
    vegetarian: true,
  },
  {
    id: 'karkade',
    chefId: 'hoda',
    category: 'drinks',
    emoji: 'hibiscus',
    name: { en: 'Iced Karkade', ar: 'كركديه ساقع', fr: 'Karkadé glacé' },
    short: {
      en: 'Chilled Aswan hibiscus tea, 1 litre',
      ar: 'كركديه أسواني ساقع، ١ لتر',
      fr: 'Infusion d’hibiscus d’Assouan glacée, 1 litre',
    },
    description: {
      en: 'Deep-red Aswan hibiscus flowers steeped overnight and lightly sweetened, served ice cold. Naturally caffeine-free and refreshing on a hot Cairo day.',
      ar: 'كركديه أسواني أحمر غامق منقوع طول الليل ومتحلي خفيف، بيتقدم ساقع جداً. خالي من الكافيين ومنعش في حر القاهرة.',
      fr: 'Fleurs d’hibiscus d’Assouan infusées toute la nuit et légèrement sucrées, servies glacées. Sans caféine et rafraîchissant.',
    },
    ingredients: {
      en: 'Dried hibiscus flowers, water, sugar, mint',
      ar: 'كركديه مجفف، ماء، سكر، نعناع',
      fr: 'Fleurs d’hibiscus séchées, eau, sucre, menthe',
    },
    allergens: [],
    price: 45,
    prepMinutes: 5,
    serves: 3,
    vegetarian: true,
  },
  {
    id: 'mango',
    chefId: 'hoda',
    category: 'drinks',
    emoji: 'mango',
    name: { en: 'Fresh Mango Juice', ar: 'عصير مانجا فريش', fr: 'Jus de mangue frais' },
    short: {
      en: 'Thick Ismailia mango juice, no added sugar',
      ar: 'عصير مانجا إسماعيلاوي تقيل بدون سكر',
      fr: 'Jus épais de mangue d’Ismaïlia, sans sucre ajouté',
    },
    description: {
      en: 'Ripe Ismailia mangoes blended thick, with nothing added. Pure summer in a bottle (500 ml).',
      ar: 'مانجا إسماعيلاوي مستوية متضربة تقيلة، من غير أي إضافات. صيف في إزازة (٥٠٠ مل).',
      fr: 'Mangues mûres d’Ismaïlia mixées, sans rien ajouter. L’été en bouteille (500 ml).',
    },
    ingredients: {
      en: 'Fresh mango',
      ar: 'مانجا فريش',
      fr: 'Mangue fraîche',
    },
    allergens: [],
    price: 65,
    prepMinutes: 5,
    serves: 1,
    vegetarian: true,
  },

  // ——— Mama Nour ———
  {
    id: 'taameya',
    chefId: 'nour',
    category: 'healthy',
    emoji: 'falafel',
    name: { en: 'Taameya Plate', ar: 'طبق طعمية', fr: 'Assiette de taameya' },
    short: {
      en: 'Green fava-bean falafel with salad & tahini',
      ar: 'طعمية خضرا بالفول مع سلطة وطحينة',
      fr: 'Falafels verts aux fèves, salade et tahini',
    },
    description: {
      en: 'Egyptian falafel made from fava beans and loads of fresh herbs, crispy outside and bright green inside. Served with baladi salad, tahini and warm bread.',
      ar: 'طعمية مصري من الفول المدشوش وكمية كبيرة من الخضرة، مقرمشة من برا وخضرا من جوا. بتتقدم مع سلطة بلدي وطحينة وعيش سخن.',
      fr: 'Falafels égyptiens aux fèves et herbes fraîches, croustillants dehors et verts dedans. Avec salade baladi, tahini et pain chaud.',
    },
    ingredients: {
      en: 'Fava beans, parsley, coriander, dill, leek, garlic, sesame seeds, tahini, tomatoes, cucumber, baladi bread (wheat)',
      ar: 'فول مدشوش، بقدونس، كزبرة، شبت، كرات، توم، سمسم، طحينة، طماطم، خيار، عيش بلدي (قمح)',
      fr: 'Fèves, persil, coriandre, aneth, poireau, ail, graines de sésame, tahini, tomates, concombre, pain baladi (blé)',
    },
    allergens: ['gluten', 'sesame'],
    price: 70,
    prepMinutes: 20,
    serves: 1,
    vegetarian: true,
    popular: true,
  },
  {
    id: 'salad',
    chefId: 'nour',
    category: 'healthy',
    emoji: 'salad',
    name: { en: 'Green Garden Salad', ar: 'سلطة خضرا', fr: 'Salade du jardin' },
    short: {
      en: 'Crunchy greens, herbs & lemon-olive oil',
      ar: 'خضار مقرمش وأعشاب مع ليمون وزيت زيتون',
      fr: 'Crudités, herbes, citron et huile d’olive',
    },
    description: {
      en: 'Crisp lettuce, cucumber, tomato, radish, rocket and fresh mint tossed in a lemon and extra-virgin olive oil dressing. Light, fresh, and free from common allergens.',
      ar: 'خس مقرمش وخيار وطماطم وفجل وجرجير ونعناع فريش، متقلبين في صوص ليمون وزيت زيتون بكر. خفيفة وفريش وخالية من مسببات الحساسية الشائعة.',
      fr: 'Laitue croquante, concombre, tomate, radis, roquette et menthe, assaisonnés de citron et d’huile d’olive vierge extra. Légère, fraîche et sans allergènes courants.',
    },
    ingredients: {
      en: 'Lettuce, cucumber, tomatoes, radish, rocket, mint, lemon, extra-virgin olive oil, salt',
      ar: 'خس، خيار، طماطم، فجل، جرجير، نعناع، ليمون، زيت زيتون بكر، ملح',
      fr: 'Laitue, concombre, tomates, radis, roquette, menthe, citron, huile d’olive vierge extra, sel',
    },
    allergens: [],
    price: 75,
    prepMinutes: 10,
    serves: 1,
    vegetarian: true,
  },
  {
    id: 'grilled-chicken',
    chefId: 'nour',
    category: 'healthy',
    emoji: 'poultry',
    name: { en: 'Grilled Chicken & Veggies', ar: 'فراخ مشوية بالخضار', fr: 'Poulet grillé et légumes' },
    short: {
      en: 'Herb-marinated chicken with roasted vegetables',
      ar: 'فراخ متبلة بالأعشاب مع خضار مشوي',
      fr: 'Poulet mariné aux herbes et légumes rôtis',
    },
    description: {
      en: 'Chicken thighs marinated overnight in lemon, garlic, thyme and a little yoghurt, grilled over charcoal, served with roasted zucchini, carrots and peppers.',
      ar: 'أوراك فراخ متبلة طول الليل بالليمون والتوم والزعتر وشوية زبادي، مشوية على الفحم، ومعاها كوسة وجزر وفلفل مشوي.',
      fr: 'Hauts de cuisse marinés toute la nuit au citron, ail, thym et un peu de yaourt, grillés au charbon, avec courgettes, carottes et poivrons rôtis.',
    },
    ingredients: {
      en: 'Chicken, yoghurt (milk), lemon, garlic, thyme, olive oil, zucchini, carrots, bell peppers',
      ar: 'فراخ، زبادي (لبن)، ليمون، توم، زعتر، زيت زيتون، كوسة، جزر، فلفل رومي',
      fr: 'Poulet, yaourt (lait), citron, ail, thym, huile d’olive, courgettes, carottes, poivrons',
    },
    allergens: ['dairy'],
    price: 210,
    prepMinutes: 35,
    serves: 1,
  },
  {
    id: 'kofta',
    chefId: 'nour',
    category: 'main',
    emoji: 'meat',
    name: { en: 'Charcoal Kofta', ar: 'كفتة على الفحم', fr: 'Kofta au charbon' },
    short: {
      en: 'Spiced beef & lamb kofta with tahini and salad',
      ar: 'كفتة لحم بقري وضاني مع طحينة وسلطة',
      fr: 'Kofta bœuf-agneau épicée, tahini et salade',
    },
    description: {
      en: 'Hand-shaped skewers of minced beef and lamb with onion, parsley and seven spices, grilled over charcoal. Served with tahini, pickles, baladi salad and bread.',
      ar: 'أصابع كفتة لحم بقري وضاني مع بصل وبقدونس وسبع بهارات، مشوية على الفحم. بتتقدم مع طحينة ومخلل وسلطة بلدي وعيش.',
      fr: 'Brochettes de bœuf et d’agneau hachés aux oignons, persil et sept épices, grillées au charbon. Avec tahini, pickles, salade baladi et pain.',
    },
    ingredients: {
      en: 'Minced beef, minced lamb, onions, parsley, seven spices, tahini (sesame), baladi bread (wheat), tomatoes, cucumber',
      ar: 'لحمة بقري مفرومة، لحمة ضاني مفرومة، بصل، بقدونس، سبع بهارات، طحينة (سمسم)، عيش بلدي (قمح)، طماطم، خيار',
      fr: 'Bœuf haché, agneau haché, oignons, persil, sept épices, tahini (sésame), pain baladi (blé), tomates, concombre',
    },
    allergens: ['gluten', 'sesame'],
    price: 230,
    prepMinutes: 30,
    serves: 1,
  },
  {
    id: 'lemon-mint',
    chefId: 'nour',
    category: 'drinks',
    emoji: 'lemon',
    name: { en: 'Lemon Mint', ar: 'ليمون بالنعناع', fr: 'Citron-menthe' },
    short: {
      en: 'Frozen lemonade with fresh mint',
      ar: 'ليمون فريش ساقع بالنعناع',
      fr: 'Citronnade glacée à la menthe fraîche',
    },
    description: {
      en: 'Freshly squeezed lemons blended with ice and a handful of mint leaves, lightly sweetened with honey. 500 ml.',
      ar: 'ليمون معصور فريش متضرب مع تلج وحفنة نعناع، ومتحلي خفيف بالعسل. ٥٠٠ مل.',
      fr: 'Citrons pressés mixés avec de la glace et des feuilles de menthe, légèrement sucrés au miel. 500 ml.',
    },
    ingredients: {
      en: 'Lemons, fresh mint, honey, ice, water',
      ar: 'ليمون، نعناع فريش، عسل، تلج، ماء',
      fr: 'Citrons, menthe fraîche, miel, glace, eau',
    },
    allergens: [],
    price: 50,
    prepMinutes: 5,
    serves: 1,
    vegetarian: true,
  },
];

export const getChef = (id: string) => CHEFS.find((c) => c.id === id);
export const getDish = (id: string) => DISHES.find((d) => d.id === id);
export const dishesByChef = (chefId: string) => DISHES.filter((d) => d.chefId === chefId);
