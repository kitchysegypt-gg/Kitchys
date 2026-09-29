import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmojiName } from '@/lib/emoji';
import { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Emoji3D } from './Emoji3D';
import { Button3D, Txt } from './ui';

const STEPS: { emoji: EmojiName; side: EmojiName[]; title: TranslationKey; body: TranslationKey }[] = [
  { emoji: 'cooking', side: ['heart', 'sparkles'], title: 'onb1Title', body: 'onb1Body' },
  { emoji: 'chef_1', side: ['grandma_1', 'chef_2'], title: 'onb2Title', body: 'onb2Body' },
  { emoji: 'search', side: ['warning', 'check'], title: 'onb3Title', body: 'onb3Body' },
  { emoji: 'cart', side: ['plus', 'receipt'], title: 'onb4Title', body: 'onb4Body' },
  { emoji: 'truck', side: ['gift', 'party'], title: 'onb5Title', body: 'onb5Body' },
];

/** "How to use the app" slides — shown on first launch and from Settings. */
export function Walkthrough({ onDone }: { onDone: () => void }) {
  const { t, colors } = useSettings();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const last = index === STEPS.length - 1;

  const next = () => {
    if (last) return onDone();
    list.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  return (
    <LinearGradient colors={[colors.background, colors.surfaceAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.top}>
          <Txt variant="label" color={colors.primary}>
            {index + 1} / {STEPS.length}
          </Txt>
          {!last && (
            <Pressable onPress={onDone} hitSlop={10}>
              <Txt style={{ fontWeight: '700' }} muted>
                {t('skip')}
              </Txt>
            </Pressable>
          )}
        </View>

        <FlatList
          ref={list}
          data={STEPS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.title}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={styles.art}>
                <View style={[styles.glow, { backgroundColor: colors.primary }]} />
                <Emoji3D name={item.side[0]} size={64} float sway style={styles.sideLeft} />
                <Emoji3D name={item.emoji} size={180} float />
                <Emoji3D name={item.side[1]} size={64} float sway style={styles.sideRight} />
              </View>
              <Txt variant="title" center>
                {t(item.title)}
              </Txt>
              <Txt muted center style={{ marginTop: 12, fontSize: 17, lineHeight: 25 }}>
                {t(item.body)}
              </Txt>
            </View>
          )}
        />

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 26 : 10 },
                ]}
              />
            ))}
          </View>
          <Button3D title={last ? t('getStarted') : t('next')} emoji={last ? 'party' : undefined} onPress={next} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  slide: { paddingHorizontal: 32, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center', height: 280, marginBottom: 12 },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.12 },
  sideLeft: { position: 'absolute', left: 10, top: 30 },
  sideRight: { position: 'absolute', right: 10, bottom: 30 },
  bottom: { padding: 24, gap: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 10, borderRadius: 5 },
});
