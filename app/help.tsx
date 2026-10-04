import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, Icon, ScreenHeader, Txt } from '@/components/ui';
import { HELP, HelpAudience, HelpTopic } from '@/data/help';
import type { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';

/** {key} in a guide sentence is a button or screen name, shown with the app's real label. */
const LABEL = /\{(\w+)\}/g;

/**
 * Help & guide: everything about using Kitchy's, for customers and for home chefs, in the
 * app's language. Topics open one at a time; the search box looks through all of them.
 */
export default function HelpScreen() {
  const { t, l, colors, isRTL } = useSettings();
  const params = useLocalSearchParams<{ for?: string }>();
  const [audience, setAudience] = useState<HelpAudience>(params.for === 'chef' ? 'chef' : 'customer');
  const [open, setOpen] = useState<string | null>(HELP[audience][0]?.id ?? null);
  const [query, setQuery] = useState('');

  const plain = (text: string) => text.replace(LABEL, (_, key) => t(key as TranslationKey));

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP[audience];
    // Searching looks through both guides, so nobody has to know which one has the answer.
    return [...HELP.customer, ...HELP.chef].filter((topic) =>
      [topic.title, ...topic.steps, ...(topic.tip ? [topic.tip] : [])].some((text) =>
        plain(l(text)).toLowerCase().includes(q)
      )
    );
    // `plain` and `l` follow the language, which `l` already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, query, l]);

  const pick = (next: HelpAudience) => {
    setAudience(next);
    setQuery('');
    setOpen(HELP[next][0]?.id ?? null);
  };

  /** A sentence with its button names in bold, in the app's own words. */
  const sentence = (text: string) =>
    text.split(LABEL).map((part, i) =>
      i % 2 === 1 ? (
        <Txt key={i} style={{ fontWeight: '800', color: colors.primary, fontSize: 16 }}>
          “{t(part as TranslationKey)}”
        </Txt>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    );

  const searching = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('helpTitle')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <Chip label={t('helpForCustomers')} icon="bag-handle-outline" active={audience === 'customer' && !searching} onPress={() => pick('customer')} />
          <Chip label={t('helpForChefs')} icon="restaurant-outline" active={audience === 'chef' && !searching} onPress={() => pick('chef')} />
        </View>

        <View style={[styles.search, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Icon name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('helpSearch')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
            accessibilityLabel={t('helpSearch')}
          />
          {searching && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Icon name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {!searching && (
          <Txt muted style={{ fontSize: 15 }}>
            {audience === 'customer' ? t('helpIntroCustomers') : t('helpIntroChefs')}
          </Txt>
        )}

        {topics.length === 0 && (
          <Txt muted center style={{ marginTop: 20 }}>
            {t('helpNothingFound')}
          </Txt>
        )}

        {topics.map((topic, index) => (
          <TopicCard
            key={`${topic.id}-${index}`}
            topic={topic}
            number={searching ? null : index + 1}
            expanded={searching || open === topic.id}
            onToggle={() => setOpen((cur) => (cur === topic.id ? null : topic.id))}
            sentence={(text) => sentence(l(text))}
          />
        ))}

        {!searching && (
          <Pressable onPress={() => router.push('/guide')} accessibilityRole="button">
            <Card style={styles.tour}>
              <Icon name="play-circle-outline" size={26} color={colors.primary} />
              <Txt style={{ flex: 1, fontWeight: '700' }}>{t('helpQuickTour')}</Txt>
              <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function TopicCard({
  topic,
  number,
  expanded,
  onToggle,
  sentence,
}: {
  topic: HelpTopic;
  number: number | null;
  expanded: boolean;
  onToggle: () => void;
  sentence: (text: HelpTopic['steps'][number]) => React.ReactNode;
}) {
  const { l, colors } = useSettings();
  return (
    <Card style={{ padding: 0 }}>
      <Pressable
        onPress={onToggle}
        style={styles.topicHead}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={l(topic.title)}>
        <View style={[styles.topicIcon, { backgroundColor: `${colors.primary}18` }]}>
          <Icon name={topic.icon} size={22} color={colors.primary} />
        </View>
        <Txt style={{ flex: 1, fontSize: 17, fontWeight: '800' }}>
          {number ? `${number}. ` : ''}
          {l(topic.title)}
        </Txt>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {expanded && (
        <View style={styles.topicBody}>
          {topic.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Txt style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 13 }}>{i + 1}</Txt>
              </View>
              <Txt style={{ flex: 1, fontSize: 16, lineHeight: 24 }}>{sentence(step)}</Txt>
            </View>
          ))}
          {topic.tip && (
            <View style={[styles.tip, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary }]}>
              <Icon name="bulb-outline" size={20} color={colors.primary} />
              <Txt style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{sentence(topic.tip)}</Txt>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  topicIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topicBody: { paddingHorizontal: 14, paddingBottom: 16, gap: 12 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tip: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderStartWidth: 3 },
  tour: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
