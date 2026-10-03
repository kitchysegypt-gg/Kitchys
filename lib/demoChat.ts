import { ALLERGEN_EMOJI, CHEFS, DISHES } from '@/data/menu';
import type { Language } from './i18n';
import { translate } from './i18n';
import { REWARDS, RANKS } from './loyalty';

/**
 * Offline answers for the demo build, where the real Claude-powered assistant
 * (supabase/functions/kitchy-chat) can't be reached. Simple keyword matching.
 */
export function demoChatReply(question: string, language: Language): string {
  const q = question.toLowerCase();
  const name = (d: { name: Record<Language, string> }) => d.name[language] ?? d.name.en;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const sep = language === 'ar' ? '، ' : ', ';
  const note = {
    en: '\n\n(Demo preview: sample answer. In the app, Kitchy is powered by Claude.)',
    ar: '\n\n(نسخة تجريبية: إجابة نموذجية. في التطبيق، كيتشي يعمل بتقنية Claude.)',
    fr: '\n\n(Démo : réponse d’exemple. Dans l’app, Kitchy fonctionne avec Claude.)',
  }[language];

  // A specific dish mentioned by name -> its allergens.
  const dish = DISHES.find((d) => Object.values(d.name).some((n) => q.includes(n.toLowerCase())));
  if (dish) {
    const allergens = dish.allergens.map((a) => t(`al_${a}`)).join(sep);
    const text = {
      en: `${name(dish)}: ${dish.short.en}. ${dish.allergens.length ? `Contains: ${allergens}.` : 'No common allergens.'} Price EGP ${dish.price}.`,
      ar: `${name(dish)}: ${dish.short.ar}. ${dish.allergens.length ? `يحتوي على: ${allergens}.` : 'خالٍ من مسببات الحساسية الشائعة.'} السعر ${dish.price} ج.م.`,
      fr: `${name(dish)} : ${dish.short.fr}. ${dish.allergens.length ? `Contient : ${allergens}.` : 'Aucun allergène courant.'} Prix ${dish.price} EGP.`,
    }[language];
    return text + note;
  }

  if (/gluten|جلوتين|قمح/.test(q)) {
    const list = DISHES.filter((d) => !d.allergens.includes('gluten'))
      .map(name)
      .join(sep);
    return (
      { en: `Gluten-free picks: ${list}.`, ar: `أطباق خالية من الجلوتين: ${list}.`, fr: `Sans gluten : ${list}.` }[
        language
      ] + note
    );
  }

  if (/allerg|حساسي|nut|مكسرات|dairy|lait|ألبان/.test(q)) {
    const list = DISHES.filter((d) => d.allergens.length === 0)
      .map(name)
      .join(sep);
    return (
      {
        en: `Every dish page lists its allergens (${Object.keys(ALLERGEN_EMOJI).length} tracked). Dishes with no common allergens: ${list}.`,
        ar: `صفحة كل طبق فيها مسببات الحساسية. أطباق خالية من مسببات الحساسية الشائعة: ${list}.`,
        fr: `Chaque fiche indique ses allergènes. Plats sans allergène courant : ${list}.`,
      }[language] + note
    );
  }

  if (/dessert|sweet|حلو|حلويات|sucr/.test(q)) {
    const list = DISHES.filter((d) => d.category === 'desserts')
      .map(name)
      .join(sep);
    return (
      {
        en: `Nana Hoda's desserts are loved: ${list}. Om Ali is the favourite, served warm.`,
        ar: `حلويات نانا هدى: ${list}. أم علي هي المفضلة وبتتقدم سخنة.`,
        fr: `Les desserts de Nana Hoda : ${list}. L’Om Ali, servi chaud, est le préféré.`,
      }[language] + note
    );
  }

  if (/refer|friend|code|cashback|credit|ادعي|صاحب|كود|رصيد|كاش|parrain|\bamie?s?\b|crédit/.test(q)) {
    return (
      {
        en: "Open More > Refer a friend to get your code (it starts with KIT). When a friend enters it in the cart on their first order, you get 10% of that order as Kitchy's credit, with no maximum. Turn on \"Use my credit\" in the cart to take it off your next order.",
        ar: 'افتح المزيد > ادعي صاحبك وخد الكود بتاعك (بيبدأ بـ KIT). لما صاحبك يكتبه في السلة في أول طلب ليه، هتاخد ١٠٪ من الطلب ده رصيد في كيتشيز من غير حد أقصى. فعّل "استخدم رصيدي" في السلة عشان يتخصم من طلبك الجاي.',
        fr: "Ouvrez Plus > Parrainer un ami pour obtenir votre code (il commence par KIT). Quand un ami le saisit dans le panier pour sa première commande, vous recevez 10 % de cette commande en crédit Kitchy's, sans plafond. Activez « Utiliser mon crédit » dans le panier pour le déduire de votre prochaine commande.",
      }[language] + note
    );
  }

  if (/point|reward|rank|نقاط|نقطة|مكافأ|مستوى|avantage|rang/.test(q)) {
    const ranks = RANKS.map((r) => `${t(`rank_${r.id}`)} ${r.minOrders}+ (×${r.multiplier})`).join(sep);
    const cheapest = REWARDS[0];
    return (
      {
        en: `You earn 1 point per EGP 10 spent. Ranks: ${ranks}. Rewards start at ${cheapest.cost} points for ${t(cheapest.label)}. Redeem them in More > Kitchy's Points.`,
        ar: `بتكسب نقطة مع كل ١٠ ج.م. المستويات: ${ranks}. المكافآت بتبدأ من ${cheapest.cost} نقطة لـ ${t(cheapest.label)}. استبدلها من المزيد > نقاط كيتشيز.`,
        fr: `1 point par tranche de 10 EGP. Rangs : ${ranks}. Les avantages commencent à ${cheapest.cost} points pour ${t(cheapest.label)}. Échangez-les dans Plus > Points Kitchy's.`,
      }[language] + note
    );
  }

  if (/chef|شيف|cheffe|cook|طباخ/.test(q)) {
    const list = CHEFS.map((c) => `${c.name[language]} (${c.specialty[language]})`).join(sep);
    return (
      { en: `Our home chefs: ${list}.`, ar: `شيفات البيت: ${list}.`, fr: `Nos cheffes : ${list}.` }[language] + note
    );
  }

  const popular = DISHES.filter((d) => d.popular)
    .map(name)
    .join(sep);
  return (
    {
      en: `Our most popular dishes right now: ${popular}. Ask me about any dish, allergies, or points.`,
      ar: `الأطباق الأكثر طلباً دلوقتي: ${popular}. اسألني عن أي طبق أو الحساسية أو النقاط.`,
      fr: `Les plats les plus demandés : ${popular}. Posez-moi vos questions sur un plat, les allergies ou les points.`,
    }[language] + note
  );
}
