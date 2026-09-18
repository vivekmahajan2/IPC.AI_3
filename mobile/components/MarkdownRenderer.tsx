import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  TouchableOpacity,
  TextStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';

interface MarkdownRendererProps {
  content: string;
  color?: string;
  baseFontSize?: number;
}

export default function MarkdownRenderer({
  content,
  color,
  baseFontSize = FontSize.sm,
}: MarkdownRendererProps) {
  const { colors, isDark } = useTheme();
  const textColor = color || colors.text;

  // --- Inline Formatter ---
  const renderInline = (
    text: string,
    overrideStyle?: TextStyle,
    keyPrefix = 'inline'
  ): React.ReactNode => {
    if (!text) return null;

    // Tokenize for:
    // 1. Bold & Italic: ***text***
    // 2. Bold: **text** or __text__
    // 3. Italic: *text* or _text_
    // 4. Inline code: `text`
    // 5. Links: [text](url)
    const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|(?<!\w)_[^_]+_(?!\w)|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (!part) return null;

      // ***bold italic***
      if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
        return (
          <Text
            key={key}
            style={[
              { fontWeight: '700', fontStyle: 'italic', color: textColor },
              overrideStyle,
            ]}
          >
            {part.slice(3, -3)}
          </Text>
        );
      }

      // **bold** or __bold__
      if (
        (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
      ) {
        return (
          <Text
            key={key}
            style={[
              { fontWeight: '700', color: textColor },
              overrideStyle,
            ]}
          >
            {part.slice(2, -2)}
          </Text>
        );
      }

      // *italic* or _italic_
      if (
        (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
      ) {
        return (
          <Text
            key={key}
            style={[
              { fontStyle: 'italic', color: textColor },
              overrideStyle,
            ]}
          >
            {part.slice(1, -1)}
          </Text>
        );
      }

      // `inline code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <Text
            key={key}
            style={[
              styles.inlineCode,
              {
                backgroundColor: isDark ? '#27272A' : '#E2E8F0',
                color: isDark ? '#F472B6' : '#BE185D',
              },
              overrideStyle,
            ]}
          >
            {' '}{part.slice(1, -1)}{' '}
          </Text>
        );
      }

      // [link text](url)
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, url] = linkMatch;
          return (
            <Text
              key={key}
              style={[
                { color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
                overrideStyle,
              ]}
              onPress={() => Linking.openURL(url)}
            >
              {label}
            </Text>
          );
        }
      }

      // Normal text segment
      return (
        <Text key={key} style={[{ color: textColor }, overrideStyle]}>
          {part}
        </Text>
      );
    });
  };

  // --- Block-Level Parsing ---
  const normalized = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  interface Block {
    type: 'heading' | 'divider' | 'table' | 'code' | 'quote' | 'ul' | 'ol' | 'paragraph';
    level?: number;
    text?: string;
    lang?: string;
    headers?: string[];
    rows?: string[][];
    items?: string[];
    orderNum?: string;
  }

  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Empty lines
    if (!line) {
      i++;
      continue;
    }

    // 2. Fenced Code Block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'code',
        lang,
        text: codeLines.join('\n'),
      });
      continue;
    }

    // 3. Table Block
    // Check if current line has '|' and next line is a separator like |---|---|
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('|') &&
      /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(lines[i + 1].trim())
    ) {
      const parseCells = (rowText: string): string[] => {
        const trimmed = rowText.trim();
        let cleaned = trimmed;
        if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
        if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
        return cleaned.split('|').map((c) => c.trim());
      };

      const headers = parseCells(lines[i]);
      i += 2; // Skip header line and separator line

      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const rowCells = parseCells(lines[i]);
        // Pad row cells to match headers length
        while (rowCells.length < headers.length) {
          rowCells.push('');
        }
        rows.push(rowCells);
        i++;
      }

      blocks.push({
        type: 'table',
        headers,
        rows,
      });
      continue;
    }

    // 4. Headings: #, ##, ###, ####, #####, ######
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Horizontal Divider: ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // 6. Blockquote: > text
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'quote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    // 7. Unordered List: - item, * item, + item
    const ulMatch = line.match(/^([-*+])\s+(.*)/);
    if (ulMatch) {
      blocks.push({
        type: 'ul',
        text: ulMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 8. Ordered List: 1. item
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      blocks.push({
        type: 'ol',
        orderNum: olMatch[1],
        text: olMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 9. Regular Paragraph (gather lines until blank or next block)
    const paraLines: string[] = [rawLine];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^(\s*[-*_]\s*){3,}$/.test(lines[i].trim()) &&
      !lines[i].trim().match(/^([-*+]|\d+\.)\s+/) &&
      !(lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && /^\|?(\s*:?-+:?\s*\|)+/.test(lines[i + 1].trim()))
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    blocks.push({
      type: 'paragraph',
      text: paraLines.join('\n'),
    });
  }

  // --- Render Blocks ---
  return (
    <View style={styles.container}>
      {blocks.map((block, bIdx) => {
        const key = `block-${bIdx}`;

        switch (block.type) {
          case 'heading': {
            const level = block.level || 1;
            let headingSize = baseFontSize + 6;
            let headingWeight: '800' | '700' | '600' = '800';
            let marginTop = Spacing.md;
            let marginBottom = Spacing.xs;
            let headingColor = textColor;

            if (level === 1) {
              headingSize = baseFontSize + 8;
              headingWeight = '800';
              marginTop = Spacing.lg;
              marginBottom = Spacing.sm;
            } else if (level === 2) {
              headingSize = baseFontSize + 5;
              headingWeight = '700';
              marginTop = Spacing.md;
            } else if (level === 3) {
              headingSize = baseFontSize + 3;
              headingWeight = '700';
              headingColor = colors.primary;
            } else {
              headingSize = baseFontSize + 1;
              headingWeight = '600';
            }

            return (
              <View key={key} style={[styles.headingWrapper, { marginTop, marginBottom }]}>
                <Text
                  style={[
                    styles.headingText,
                    {
                      fontSize: headingSize,
                      fontWeight: headingWeight,
                      color: headingColor,
                    },
                  ]}
                >
                  {renderInline(block.text || '', {
                    fontSize: headingSize,
                    fontWeight: headingWeight,
                    color: headingColor,
                  }, `h-${bIdx}`)}
                </Text>
              </View>
            );
          }

          case 'divider': {
            return (
              <View
                key={key}
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
            );
          }

          case 'table': {
            const headers = block.headers || [];
            const rows = block.rows || [];
            const colCount = Math.max(headers.length, 1);

            // Responsive min width per column
            let minColWidth = 140;
            if (colCount === 2) minColWidth = 160;
            else if (colCount === 3) minColWidth = 150;
            else if (colCount >= 4) minColWidth = 125;

            return (
              <View key={key} style={styles.tableWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={{ minWidth: '100%' }}
                >
                  <View style={[styles.table, { borderColor: colors.border }]}>
                    {/* Header Row */}
                    <View
                      style={[
                        styles.tableRow,
                        styles.tableHeaderRow,
                        {
                          backgroundColor: isDark ? '#26262E' : '#EFF6FF',
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      {headers.map((h, hIdx) => (
                        <View
                          key={`th-${hIdx}`}
                          style={[
                            styles.tableCell,
                            styles.tableHeaderCell,
                            {
                              minWidth: minColWidth,
                              borderRightColor: hIdx < headers.length - 1 ? colors.border : 'transparent',
                            },
                          ]}
                        >
                          <Text style={{ fontWeight: '700', fontSize: FontSize.xs, color: colors.primary }}>
                            {renderInline(h, { fontWeight: '700', fontSize: FontSize.xs, color: colors.primary }, `th-${bIdx}-${hIdx}`)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Data Rows */}
                    {rows.map((row, rIdx) => {
                      const isEven = rIdx % 2 === 0;
                      const rowBg = isEven
                        ? colors.surface
                        : (isDark ? '#1C1C22' : '#F8FAFC');

                      return (
                        <View
                          key={`tr-${rIdx}`}
                          style={[
                            styles.tableRow,
                            {
                              backgroundColor: rowBg,
                              borderBottomColor: rIdx < rows.length - 1 ? colors.border : 'transparent',
                            },
                          ]}
                        >
                          {row.map((cell, cIdx) => (
                            <View
                              key={`td-${rIdx}-${cIdx}`}
                              style={[
                                styles.tableCell,
                                {
                                  minWidth: minColWidth,
                                  borderRightColor: cIdx < row.length - 1 ? colors.border : 'transparent',
                                },
                              ]}
                            >
                              <Text style={{ fontSize: FontSize.xs, color: textColor, lineHeight: 18 }}>
                                {renderInline(cell, { fontSize: FontSize.xs, color: textColor, lineHeight: 18 }, `td-${bIdx}-${rIdx}-${cIdx}`)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            );
          }

          case 'code': {
            return (
              <View
                key={key}
                style={[
                  styles.codeBlockContainer,
                  { backgroundColor: isDark ? '#131317' : '#1E293B', borderColor: colors.border },
                ]}
              >
                {block.lang ? (
                  <View style={styles.codeLangHeader}>
                    <Text style={styles.codeLangText}>{block.lang}</Text>
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.codeBlockText}>{block.text}</Text>
                </ScrollView>
              </View>
            );
          }

          case 'quote': {
            return (
              <View
                key={key}
                style={[
                  styles.quoteContainer,
                  {
                    borderLeftColor: colors.primary,
                    backgroundColor: isDark ? 'rgba(92,147,252,0.08)' : 'rgba(26,86,219,0.05)',
                  },
                ]}
              >
                <Text style={[styles.quoteText, { color: textColor }]}>
                  {renderInline(block.text || '', { fontStyle: 'italic' }, `q-${bIdx}`)}
                </Text>
              </View>
            );
          }

          case 'ul': {
            return (
              <View key={key} style={styles.listItemRow}>
                <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                <View style={styles.listItemContent}>
                  <Text style={[styles.paragraphText, { fontSize: baseFontSize, color: textColor }]}>
                    {renderInline(block.text || '', { fontSize: baseFontSize, color: textColor }, `ul-${bIdx}`)}
                  </Text>
                </View>
              </View>
            );
          }

          case 'ol': {
            return (
              <View key={key} style={styles.listItemRow}>
                <View style={[styles.numBadge, { backgroundColor: isDark ? '#2D2D36' : '#EFF6FF' }]}>
                  <Text style={[styles.numBadgeText, { color: colors.primary }]}>
                    {block.orderNum}
                  </Text>
                </View>
                <View style={styles.listItemContent}>
                  <Text style={[styles.paragraphText, { fontSize: baseFontSize, color: textColor }]}>
                    {renderInline(block.text || '', { fontSize: baseFontSize, color: textColor }, `ol-${bIdx}`)}
                  </Text>
                </View>
              </View>
            );
          }

          case 'paragraph':
          default: {
            return (
              <View key={key} style={styles.paragraphWrapper}>
                <Text
                  style={[
                    styles.paragraphText,
                    { fontSize: baseFontSize, color: textColor, lineHeight: baseFontSize * 1.55 },
                  ]}
                >
                  {renderInline(block.text || '', { fontSize: baseFontSize, color: textColor }, `p-${bIdx}`)}
                </Text>
              </View>
            );
          }
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headingWrapper: {
    width: '100%',
  },
  headingText: {
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.sm,
  },
  paragraphWrapper: {
    marginVertical: 4,
  },
  paragraphText: {
    letterSpacing: 0.1,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: FontSize.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  tableWrapper: {
    marginVertical: Spacing.sm,
    width: '100%',
  },
  table: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    borderBottomWidth: 1.5,
  },
  tableCell: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    paddingVertical: 10,
  },
  codeBlockContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  codeLangHeader: {
    marginBottom: 6,
  },
  codeLangText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: FontSize.xs,
    color: '#F1F5F9',
    lineHeight: 18,
  },
  quoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.xs,
    marginVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  quoteText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  bulletDot: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
    lineHeight: 22,
  },
  numBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  numBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listItemContent: {
    flex: 1,
  },
});
