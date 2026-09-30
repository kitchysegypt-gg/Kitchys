import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ALLERGEN_EMOJI, Allergen, CATEGORIES, Category } from '@/data/menu';
import { DishDraft } from '@/lib/chef';
import { useSettings } from '@/lib/settings';
import { Emoji3D } from './Emoji3D';
import { Card3D, Chip, Txt } from './ui';

const ALLERGENS = Object.keys(ALLERGEN_EMOJI) as Allergen[];

/** Form for one dinner dish: name, description, ingredients, price, category, allergens. */
export function DishEditor({
  value,
  onChange,
  onRemove,
  title,
}: {
  value: DishDraft;
  onChange: (d: DishDraft) => void;
  onRemove?: () => void;
  title: string;
}) {
  const { t, colors, isRTL } = useSettings();
  const set = (patch: Partial<DishDraft>) => onChange({ ...value, ...patch });
  const input = [
    styles.input,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      color: colors.text,
      textAlign: isRTL ? 'right' : 'left',
    } as const,
  ];

  const toggleAllergen = (a: Allergen) =>
    set({ allergens: value.allergens.includes(a) ? value.allergens.filter((x) => x !== a) : [...value.allergens, a] });

  return (
    <Card3D style={{ gap: 10 }}>
      <View style={styles.row}>
        <Emoji3D name="pot" size={26} />
        <Txt style={{ flex: 1, fontWeight: '900' }}>{title}</Txt>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Txt style={{ color: colors.danger, fontWeight: '800' }}>{t('removeDish')}</Txt>
          </Pressable>
        )}
      </View>
      <TextInput
        value={value.name}
        onChangeText={(name) => set({ name })}
        placeholder={t('dishName')}
        placeholderTextColor={colors.textMuted}
        maxLength={80}
        style={input}
      />
      <TextInput
        value={value.description}
        onChangeText={(description) => set({ description })}
        placeholder={t('dishDescription')}
        placeholderTextColor={colors.textMuted}
        maxLength={800}
        multiline
        style={[input, { minHeight: 70 }]}
      />
      <TextInput
        value={value.ingredients}
        onChangeText={(ingredients) => set({ ingredients })}
        placeholder={t('dishIngredients')}
        placeholderTextColor={colors.textMuted}
        maxLength={400}
        multiline
        style={input}
      />
      <View style={styles.row}>
        <View style={{ flex: 1.2, gap: 4 }}>
          <Txt variant="caption" muted>
            {t('dishPrice')}
          </Txt>
          <TextInput
            value={value.price}
            onChangeText={(price) => set({ price: price.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="150"
            placeholderTextColor={colors.textMuted}
            style={input}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="caption" muted>
            {t('dishPrep')}
          </Txt>
          <TextInput
            value={value.prepMinutes}
            onChangeText={(prepMinutes) => set({ prepMinutes: prepMinutes.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            style={input}
          />
        </View>
        <View style={{ flex: 0.8, gap: 4 }}>
          <Txt variant="caption" muted>
            {t('dishServes')}
          </Txt>
          <TextInput
            value={value.serves}
            onChangeText={(serves) => set({ serves: serves.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            style={input}
          />
        </View>
      </View>

      <Txt variant="caption" muted>
        {t('category')}
      </Txt>
      <View style={styles.wrap}>
        {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
          <Chip
            key={c.id}
            label={t(c.label)}
            emoji={c.emoji}
            active={value.category === c.id}
            onPress={() => set({ category: c.id as Category })}
          />
        ))}
      </View>

      <Txt variant="caption" muted>
        {t('allergensPick')}
      </Txt>
      <View style={styles.wrap}>
        {ALLERGENS.map((a) => (
          <Chip
            key={a}
            label={t(`al_${a}`)}
            emoji={ALLERGEN_EMOJI[a]}
            active={value.allergens.includes(a)}
            onPress={() => toggleAllergen(a)}
          />
        ))}
      </View>

      <View style={styles.row}>
        <Emoji3D name="hot_pepper" size={22} />
        <Txt style={{ flex: 1 }}>{t('spicy')}</Txt>
        <Switch value={value.spicy} onValueChange={(spicy) => set({ spicy })} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <Emoji3D name="leaf" size={22} />
        <Txt style={{ flex: 1 }}>{t('vegetarian')}</Txt>
        <Switch
          value={value.vegetarian}
          onValueChange={(vegetarian) => set({ vegetarian })}
          trackColor={{ true: colors.primary }}
        />
      </View>
    </Card3D>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15 },
});
