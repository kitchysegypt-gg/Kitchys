import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmojiName } from '@/lib/emoji';
import { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { Emoji3D } from './Emoji3D';
import { Logo } from './Logo';
import { Button3D, Txt } from './ui';

type Step = { emoji?: EmojiName; tint: string; title: TranslationKey; body: TranslationKey };

// The first step shows the logo instead of an emoji.
const STEPS: Step[] = [
  { tint: '#FFE3D3', title: 'onb1Title', body: 'onb1Body' },
  { emoji: 'chef_1', tint: '#FFE3D3', title: 'onb2Title', body: 'onb2Body' },
  { emoji: 'search', tint: '#D9F0FF', title: 'onb3Title', body: 'onb3Body' },
  { emoji: 'pin', tint: '#FFE0EC', title: 'onb4Title', body: 'onb4Body' },
  { emoji: 'trophy', tint: '#FFF1C7', title: 'onb5Title', body: 'onb5Body' },
  { emoji: 'robot', tint: '#E4E1FF', title: 'onb6Title', body: 'onb6Body' },
  { emoji: 'gift', tint: '#DDF5EA', title: 'onb7Title', body: 'onb7Body' },
];

/** "How to use the app" — shown on first launch and from Settings. */
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.top}>
          <View style={styles.progress}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.progressBar, { backgroundColor: i <= index ? colors.primary : colors.border }]}
              />
            ))}
          </View>
          {!last && (
            <Pressable onPress={onDone} hitSlop={12}>
              <Txt muted style={{ fontWeight: '700' }}>
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
          renderItem={({ item, index: i }) => (
            <View style={[styles.slide, { width }]}>
              <View style={styles.art}>
                {item.emoji ? <Plate step={item} active={i === index} /> : <Logo width={Math.min(260, width - 80)} />}
              </View>
              <Txt variant="title" center>
                {t(item.title)}
              </Txt>
              <Txt muted center style={styles.body}>
                {t(item.body)}
              </Txt>
            </View>
          )}
        />

        <View style={styles.bottom}>
          <Button3D title={last ? t('getStarted') : t('next')} onPress={next} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** A soft round "plate" with one 3D emoji that pops in when its slide becomes active. */
function Plate({ step, active }: { step: Step; active: boolean }) {
  const pop = useAnimatedValue(0);

  useEffect(() => {
    if (!active) return;
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [active, pop]);

  return (
    <View style={[styles.plate, { backgroundColor: step.tint }]}>
      <View style={styles.plateRing} />
      <Animated.View
        style={{
          opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}>
        <Emoji3D name={step.emoji!} size={140} float={active} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 12 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 5, borderRadius: 3 },
  slide: { paddingHorizontal: 32, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center', height: 290, marginBottom: 20 },
  plate: { width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center' },
  plateRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  body: { marginTop: 12, fontSize: 17, lineHeight: 25, maxWidth: 420, alignSelf: 'center' },
  bottom: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
});
