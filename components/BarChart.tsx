import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { Txt } from './ui';

export type Bar = { label: string; value: number; /** Shown when the bar is tapped. */ detail: string };

/**
 * A simple single-series bar chart: bars grow from a shared baseline, rounded at the top,
 * with a 2px gap between them. Tap a bar to read its exact value; the tallest bar is labelled.
 */
export function BarChart({
  bars,
  height = 140,
  /** Show every n-th label under the bars (others stay blank so they don't collide). */
  labelEvery = 1,
  summary,
}: {
  bars: Bar[];
  height?: number;
  labelEvery?: number;
  /** Read out by screen readers, e.g. "Sales by day, highest on Friday". */
  summary: string;
}) {
  const { colors } = useSettings();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.findIndex((b) => b.value === max && b.value > 0);
  const shown = selected ?? peak;

  return (
    <View accessible accessibilityLabel={summary} style={{ gap: 6 }}>
      <Txt variant="caption" style={{ fontWeight: '700', minHeight: 18 }} numberOfLines={1}>
        {shown >= 0 ? bars[shown].detail : ' '}
      </Txt>
      <View style={[styles.plot, { height, borderColor: colors.border }]}>
        {bars.map((b, i) => (
          <Pressable
            key={i}
            onPress={() => setSelected(selected === i ? null : i)}
            style={styles.slot}
            accessibilityRole="button"
            accessibilityLabel={b.detail}
            hitSlop={{ top: 8, bottom: 8 }}>
            <View
              style={{
                height: b.value > 0 ? Math.max(4, (b.value / max) * (height - 4)) : 2,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: b.value > 0 ? colors.primary : colors.border,
                opacity: shown === i || shown < 0 ? 1 : 0.55,
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <Txt key={i} variant="caption" muted numberOfLines={1} style={styles.label}>
            {i % labelEvery === 0 ? b.label : ''}
          </Txt>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1 },
  slot: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  labels: { flexDirection: 'row', gap: 2 },
  label: { flex: 1, textAlign: 'center', fontSize: 10 },
});
