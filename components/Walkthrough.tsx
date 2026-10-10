import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { Logo } from './Logo';
import { Button, Txt } from './ui';

// Kitchy's illustrations for each step (round, 440 x 440).
const ART = {
  chef: require('@/assets/guide/chef.png'),
  search: require('@/assets/guide/search.png'),
  location: require('@/assets/guide/location.png'),
  trophy: require('@/assets/guide/trophy.png'),
  chat: require('@/assets/guide/chat.png'),
  track: require('@/assets/guide/track.png'),
};

type Step = { art?: keyof typeof ART; title: TranslationKey; body: TranslationKey };

// The first step shows the logo.
const STEPS: Step[] = [
  { title: 'onb1Title', body: 'onb1Body' },
  { art: 'chef', title: 'onb2Title', body: 'onb2Body' },
  { art: 'search', title: 'onb3Title', body: 'onb3Body' },
  { art: 'location', title: 'onb4Title', body: 'onb4Body' },
  { art: 'trophy', title: 'onb5Title', body: 'onb5Body' },
  { art: 'chat', title: 'onb6Title', body: 'onb6Body' },
  { art: 'track', title: 'onb7Title', body: 'onb7Body' },
];

/** "How to use the app" — shown on first launch and from Settings. */
export function Walkthrough({ onDone, onFullGuide }: { onDone: () => void; /** Shows a "Read the full guide" link. */ onFullGuide?: () => void }) {
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
                {item.art ? <Plate step={item} active={i === index} /> : <Logo width={Math.min(260, width - 80)} />}
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
          <Button title={last ? t('getStarted') : t('next')} onPress={next} />
          {onFullGuide && (
            <Button title={t('helpReadFullGuide')} icon="book-outline" variant="ghost" onPress={onFullGuide} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/** The step's round illustration, fading in when its slide becomes active. */
function Plate({ step, active }: { step: Step; active: boolean }) {
  const { colors } = useSettings();
  const pop = useAnimatedValue(0);

  useEffect(() => {
    if (!active) return;
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, pop]);

  return (
    <Animated.View
      style={[
        styles.plate,
        { backgroundColor: colors.surfaceAlt },
        {
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        },
      ]}>
      {step.art && <Image source={ART[step.art]} style={StyleSheet.absoluteFill} contentFit="cover" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 12 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  slide: { paddingHorizontal: 32, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center', height: 290, marginBottom: 20 },
  plate: { width: 220, height: 220, borderRadius: 110, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  body: { marginTop: 12, fontSize: 17, lineHeight: 25, maxWidth: 420, alignSelf: 'center' },
  bottom: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
});
