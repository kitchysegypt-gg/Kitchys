import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ALLERGEN_EMOJI, Allergen, CATEGORIES, Category } from '@/data/menu';
import { DishDraft, MIN_DESCRIPTION_WORDS, MIN_INGREDIENT_WORDS, wordCount } from '@/lib/chef';
import { useSettings } from '@/lib/settings';
import { FONT } from '@/lib/fonts';
import { PhotoPicker } from './PhotoPicker';
import { Card, Chip, Icon, Txt } from './ui';

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
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <Txt style={{ flex: 1, fontWeight: '700', fontSize: 16 }}>{title}</Txt>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Txt style={{ color: colors.danger, fontWeight: '600' }}>{t('removeDish')}</Txt>
          </Pressable>
        )}
      </View>
      <PhotoPicker value={value.photo} onChange={(photo) => set({ photo })} label={t('dishPhoto')} />
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
      <WordCounter count={wordCount(value.description)} min={MIN_DESCRIPTION_WORDS} />
      <TextInput
        value={value.ingredients}
        onChangeText={(ingredients) => set({ ingredients })}
        placeholder={t('dishIngredients')}
        placeholderTextColor={colors.textMuted}
        maxLength={400}
        multiline
        style={input}
      />
      <WordCounter count={wordCount(value.ingredients)} min={MIN_INGREDIENT_WORDS} />
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
        {t('dishSize')}
      </Txt>
      <View style={styles.row}>
        <TextInput
          value={value.portionAmount}
          onChangeText={(portionAmount) => set({ portionAmount: portionAmount.replace(/[^0-9.,]/g, '') })}
          keyboardType="decimal-pad"
          placeholder={value.portionUnit === 'kg' ? '1.5' : '500'}
          placeholderTextColor={colors.textMuted}
          maxLength={6}
          style={[input, { flex: 1 }]}
        />
        <Chip label="g" active={value.portionUnit === 'g'} onPress={() => set({ portionUnit: 'g' })} />
        <Chip label="kg" active={value.portionUnit === 'kg'} onPress={() => set({ portionUnit: 'kg' })} />
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
            active={value.allergens.includes(a)}
            onPress={() => toggleAllergen(a)}
          />
        ))}
      </View>

      <View style={styles.row}>
        <Icon name="flame-outline" size={20} color="#E53935" />
        <Txt style={{ flex: 1 }}>{t('spicy')}</Txt>
        <Switch value={value.spicy} onValueChange={(spicy) => set({ spicy })} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <Icon name="leaf-outline" size={20} color="#2E9E5B" />
        <Txt style={{ flex: 1 }}>{t('vegetarian')}</Txt>
        <Switch
          value={value.vegetarian}
          onValueChange={(vegetarian) => set({ vegetarian })}
          trackColor={{ true: colors.primary }}
        />
      </View>
    </Card>
  );
}

/** "6/10 words": red until the minimum is reached, then green with a tick. */
function WordCounter({ count, min }: { count: number; min: number }) {
  const { t, colors } = useSettings();
  const done = count >= min;
  return (
    <View style={[styles.row, { marginTop: -4 }]}>
      <Icon
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={done ? colors.success : colors.textMuted}
      />
      <Txt variant="caption" style={{ color: done ? colors.success : colors.textMuted }}>
        {t('wordsCount', { n: count, min })}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular },
});
