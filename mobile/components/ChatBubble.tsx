import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BorderRadius, Spacing, FontSize, Shadow } from '../constants/theme';
import { ChatMessage, SourceReference } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const { colors } = useTheme();

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}
      >
        <Text style={[styles.messageText, { color: isUser ? colors.textOnPrimary : colors.text }]}>
          {message.content}
        </Text>

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <View style={[styles.sourcesContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.sourcesLabel, { color: colors.textSecondary }]}>Sources:</Text>
            {message.sources.map((source, index) => (
              <View key={index} style={styles.sourceItem}>
                <View style={[styles.sourceDot, { backgroundColor: colors.secondary }]} />
                <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                  {source.act && source.section
                    ? `${source.act} Section ${source.section}`
                    : source.title || 'Reference'}
                  {source.title ? ` — ${source.title}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.timestamp, { color: isUser ? 'rgba(255,255,255,0.7)' : colors.textLight }]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
    marginHorizontal: Spacing.lg,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    borderBottomRightRadius: BorderRadius.sm,
  },
  assistantBubble: {
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  sourcesContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  sourcesLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  sourceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  sourceText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
});

