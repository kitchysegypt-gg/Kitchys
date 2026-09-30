import { FunctionsHttpError } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Chip, Icon, Screen, Txt } from '@/components/ui';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

type ChatMessage = { role: 'user' | 'assistant'; content: string; failed?: boolean };

export default function ChatScreen() {
  const { t, colors, language, isRTL } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    const history: ChatMessage[] = [...messages.filter((m) => !m.failed), { role: 'user', content }];
    setMessages(history);
    setDraft('');
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('kitchy-chat', {
        body: { messages: history.map(({ role, content }) => ({ role, content })), language },
      });
      if (error) {
        // Show the server's own explanation (e.g. "not set up yet") when there is one.
        const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        throw new Error(detail?.error ?? error.message);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `${t('chatError')}\n${e?.message ?? ''}`.trim(), failed: true },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Icon name={isRTL ? 'chevron-forward' : 'chevron-back'} size={26} />
        </Pressable>
        <BotAvatar size={40} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{t('chatTitle')}</Txt>
          <Txt variant="caption" muted numberOfLines={1}>
            {t('chatSubtitle')}
          </Txt>
        </View>
        {messages.length > 0 && (
          <Pressable
            onPress={() => setMessages([])}
            hitSlop={8}
            style={[styles.newChat, { borderColor: colors.border }]}>
            <Icon name="create-outline" size={16} />
            <Txt variant="caption" style={{ fontWeight: '600' }}>
              {t('newChat')}
            </Txt>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled">
          <Bubble role="assistant" content={t('chatGreeting')} />
          {messages.length === 0 && (
            <View style={styles.suggestions}>
              {(['suggest1', 'suggest2', 'suggest3'] as const).map((key) => (
                <Chip key={key} label={t(key)} onPress={() => send(t(key))} />
              ))}
            </View>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} {...m} />
          ))}
          {thinking && <TypingBubble />}
          <View style={[styles.powered, { backgroundColor: colors.surfaceAlt }]}>
            <Txt variant="caption" muted center>
              {t('poweredBy')}
            </Txt>
          </View>
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chatPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surfaceAlt, textAlign: isRTL ? 'right' : 'left' },
            ]}
            multiline
            maxLength={2000}
            onSubmitEditing={() => send(draft)}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim() || thinking}
            style={[
              styles.send,
              { backgroundColor: colors.primary, opacity: !draft.trim() || thinking ? 0.5 : 1 },
            ]}>
            <Icon name="arrow-up" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ role, content, failed }: ChatMessage) {
  const { colors, isRTL } = useSettings();
  const mine = role === 'user';
  return (
    <View style={[styles.bubbleRow, { flexDirection: mine ? 'row-reverse' : 'row' }]}>
      {!mine && <BotAvatar size={30} />}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
            : {
                backgroundColor: failed ? colors.surfaceAlt : colors.surface,
                borderColor: failed ? colors.danger : colors.border,
                borderWidth: 1,
                borderBottomLeftRadius: 6,
              },
        ]}>
        <Txt color={mine ? colors.onPrimary : undefined} style={{ textAlign: isRTL ? 'right' : 'left' }} selectable>
          {content}
        </Txt>
      </View>
    </View>
  );
}

/** Kitchy AI's avatar: a sparkle on the brand colour. */
function BotAvatar({ size }: { size: number }) {
  const { colors } = useSettings();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name="sparkles" size={size * 0.5} color={colors.onPrimary} />
    </View>
  );
}

function TypingBubble() {
  const { colors } = useSettings();
  const pulse = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[styles.bubbleRow, { flexDirection: 'row' }]}>
      <BotAvatar size={30} />
      <View style={[styles.bubble, styles.typing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: colors.primary,
                opacity: pulse.interpolate({
                  inputRange: [0, (i + 0.5) / 3, 1],
                  outputRange: [0.3, 1, 0.3],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingStart: 38 },
  bubbleRow: { alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  typing: { flexDirection: 'row', gap: 6, borderWidth: 1, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  powered: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
