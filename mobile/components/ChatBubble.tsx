import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BorderRadius, Spacing, FontSize, Shadow } from '../constants/theme';
import { ChatMessage, SourceReference } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [
                styles.assistantBubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  ...Shadow.sm,
                },
              ],
        ]}
      >
        {isUser ? (
          <Text style={[styles.messageText, { color: colors.textOnPrimary }]}>
            {message.content}
          </Text>
        ) : (
          <View style={styles.assistantContent}>
            <View style={styles.aiBadgeRow}>
              <View style={[styles.aiSparkleIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="sparkles" size={13} color={colors.primary} />
              </View>
              <Text style={[styles.aiBadgeText, { color: colors.primary }]}>
                Legal Analysis
              </Text>
            </View>

            <MarkdownRenderer content={message.content} color={colors.text} />
          </View>
        )}

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <View style={[styles.sourcesContainer, { borderTopColor: colors.border }]}>
            <View style={styles.sourcesHeader}>
              <Ionicons name="library-outline" size={13} color={colors.primary} />
              <Text style={[styles.sourcesLabel, { color: colors.textSecondary }]}>
                Statutory Citations & Authorities:
              </Text>
            </View>
            {message.sources.map((source, index) => (
              <View key={index} style={styles.sourceItem}>
                <View style={[styles.sourceDot, { backgroundColor: colors.secondary }]} />
                <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                  {source.act && source.section
                    ? `${source.act} Section ${source.section}`
                    : source.title || 'Statute Reference'}
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
    marginHorizontal: Spacing.sm,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '96%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    maxWidth: '85%',
    borderBottomRightRadius: BorderRadius.xs,
  },
  assistantBubble: {
    borderBottomLeftRadius: BorderRadius.xs,
    borderWidth: 1,
    width: '96%',
  },
  messageText: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  assistantContent: {
    width: '100%',
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  aiSparkleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: FontSize.xxs,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  sourcesContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  sourcesLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  sourceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: Spacing.sm,
  },
  sourceText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
});
