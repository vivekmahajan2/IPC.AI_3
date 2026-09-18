import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../lib/api';
import { naturalCompareSections } from '../lib/sort';
import Header from '../components/ui/Header';
import Button from '../components/ui/Button';
import { useTheme } from '../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';
import { OtherLawStatute } from '../types';

export default function OtherLawScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategory = params.category
    ? (params.category.toLowerCase().includes('state') ? 'State Laws' : params.category)
    : null;
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [otherLawTab, setOtherLawTab] = useState<'statutes' | 'lawyers'>('statutes');
  const [selectedStatute, setSelectedStatute] = useState<OtherLawStatute | null>(null);

  // Fetch Other Law Statutes dynamically
  const { data: otherLawStatutes, isLoading: isOtherLawLoading } = useQuery({
    queryKey: ['other-law-statutes', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await api.get(`/other-law`, { params: { category: selectedCategory } });
      return res.data;
    },
    enabled: !!selectedCategory,
  });

  // Fetch Specialized Advocates for selected Other Law category
  const { data: categoryLawyers, isLoading: isCategoryLawyersLoading } = useQuery({
    queryKey: ['category-lawyers', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      let querySpec = selectedCategory;
      if (selectedCategory === 'Civil Law') querySpec = 'Civil';
      else if (selectedCategory === 'Family Law') querySpec = 'Family';
      else if (selectedCategory === 'Commercial Law') querySpec = 'Company';
      else if (selectedCategory === 'Cyber Law') querySpec = 'Cyber';
      else if (selectedCategory === 'Labour Law') querySpec = 'Labour';
      else if (selectedCategory === 'State Laws') querySpec = 'State';
      else if (selectedCategory === 'Tax Law') querySpec = 'Tax';
      else if (selectedCategory === 'Food Law') querySpec = 'Food';
      
      const res = await api.get('/lawyers', { params: { q: querySpec } });
      return res.data;
    },
    enabled: !!selectedCategory,
  });

  // 8 categories requested by user with verified section counts
  const otherCategories = [
    { name: 'Civil Law', icon: 'document-text-outline', color: '#3B82F6', desc: 'Contracts, Property, Torts, Civil Procedure', count: '409 Sections' },
    { name: 'Family Law', icon: 'people-outline', color: '#10B981', desc: 'Marriage, Divorce, Adoption, Succession', count: '240 Sections' },
    { name: 'Commercial Law', icon: 'business-outline', color: '#F59E0B', desc: 'Companies, LLP, IBC, Banking, Consumer', count: '1,301 Sections' },
    { name: 'Cyber Law', icon: 'shield-checkmark-outline', color: '#EC4899', desc: 'IT Act, Cyber Crimes, DPDP 2023, Digital/Privacy', count: '101 Sections' },
    { name: 'Labour Law', icon: 'construct-outline', color: '#8B5CF6', desc: 'Employment, Disputes, Wages, Unions, POSH', count: '219 Sections' },
    { name: 'State Laws', icon: 'map-outline', color: '#06B6D4', desc: 'Rent Control, RERA, Police Act, MCOCA, Land', count: '376 Sections' },
    { name: 'Tax Law', icon: 'card-outline', color: '#EF4444', desc: 'Income Tax, GST, IGST, Corporate Tax', count: '508 Sections' },
    { name: 'Food Law', icon: 'fast-food-outline', color: '#10B981', desc: 'FSSAI Act, Food Safety & Standards', count: '101 Sections' },
  ];

  const handleContactLawyer = (lawyerName: string) => {
    alert(`Initiating contact with specialized advocate: ${lawyerName}`);
  };

  const renderCategoryDetail = () => {
    if (!selectedCategory) return null;

    // Available subcategories for filtering
    const subcategories = Array.from(
      new Set(
        (otherLawStatutes || [])
          .map((s: OtherLawStatute) => s.subcategory)
          .filter(Boolean)
      )
    ).sort() as string[];

    let list = otherLawStatutes || [];
    if (selectedSubcategory) {
      list = list.filter((s: OtherLawStatute) => s.subcategory === selectedSubcategory);
    }
    if (searchQuery.trim()) {
      const text = searchQuery.toLowerCase().trim();
      list = list.filter((s: OtherLawStatute) => {
        return (
          s.title.toLowerCase().includes(text) ||
          s.act_name.toLowerCase().includes(text) ||
          s.section.toLowerCase().includes(text) ||
          s.description.toLowerCase().includes(text)
        );
      });
    }

    const filteredStatutes = [...list].sort((a: OtherLawStatute, b: OtherLawStatute) => {
      const actCmp = a.act_name.localeCompare(b.act_name);
      if (actCmp !== 0) return actCmp;
      return naturalCompareSections(a.section, b.section);
    });

    return (
      <View style={{ flex: 1 }}>
        <Header
          title={selectedCategory}
          subtitle={`${filteredStatutes.length} Statutory Sections`}
          showBack
          onBack={() => {
            setSelectedCategory(null);
            setSelectedSubcategory(null);
            setSearchQuery('');
          }}
        />

        {/* Tab Switcher: Statutes v/s Advocates */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.tabButton, otherLawTab === 'statutes' && { borderBottomColor: colors.primary }]}
            onPress={() => setOtherLawTab('statutes')}
          >
            <Ionicons
              name="library-outline"
              size={16}
              color={otherLawTab === 'statutes' ? colors.primary : colors.textSecondary}
            />
            <Text style={{ color: otherLawTab === 'statutes' ? colors.text : colors.textSecondary, marginLeft: 6, fontSize: FontSize.sm, fontWeight: '600' }}>
              Statutes & Rules
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, otherLawTab === 'lawyers' && { borderBottomColor: colors.primary }]}
            onPress={() => setOtherLawTab('lawyers')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={otherLawTab === 'lawyers' ? colors.primary : colors.textSecondary}
            />
            <Text style={{ color: otherLawTab === 'lawyers' ? colors.text : colors.textSecondary, marginLeft: 6, fontSize: FontSize.sm, fontWeight: '600' }}>
              Specialized Advocates
            </Text>
          </TouchableOpacity>
        </View>

        {otherLawTab === 'statutes' ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TextInput
                placeholder={`Search ${selectedCategory} statutes...`}
                placeholderTextColor={colors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
            </View>

            {subcategories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs }}
                style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedSubcategory(null)}
                  style={[
                    styles.filterPill,
                    { borderColor: colors.border },
                    !selectedSubcategory && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.filterPillText, { color: !selectedSubcategory ? colors.textOnPrimary : colors.textSecondary }]}>
                    All
                  </Text>
                </TouchableOpacity>
                {subcategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubcategory(selectedSubcategory === sub ? null : sub)}
                    style={[
                      styles.filterPill,
                      { borderColor: colors.border },
                      selectedSubcategory === sub && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[styles.filterPillText, { color: selectedSubcategory === sub ? colors.textOnPrimary : colors.textSecondary }]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {isOtherLawLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredStatutes.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="document-text-outline" size={48} color={colors.textLight} />
                <Text style={{ marginTop: 10, color: colors.textSecondary }}>No statutes found matching query.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.listContent}>
                {filteredStatutes.map((statute: OtherLawStatute) => (
                  <TouchableOpacity
                    key={statute.id}
                    style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setSelectedStatute(statute)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', color: colors.primary, fontSize: FontSize.sm }}>
                          {statute.section}
                        </Text>
                        {statute.subcategory && (
                          <View style={[styles.subcatBadge, { backgroundColor: colors.primaryLight }]}>
                            <Text style={[styles.subcatText, { color: colors.primary }]}>
                              {statute.subcategory}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                        {statute.title}
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {statute.act_name}
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textLight, marginTop: 6, lineHeight: 16 }} numberOfLines={2}>
                        {statute.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} style={{ alignSelf: 'center', marginLeft: 8 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {isCategoryLawyersLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : !categoryLawyers || categoryLawyers.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="people-outline" size={48} color={colors.textLight} />
                <Text style={{ marginTop: 10, color: colors.textSecondary }}>No specialized advocates found in directory.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.listContent}>
                {categoryLawyers.map((lawyer: any) => (
                  <TouchableOpacity
                    key={lawyer.id}
                    style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleContactLawyer(lawyer.name)}
                  >
                    <View style={[styles.avatarBox, { backgroundColor: colors.primaryLight }]}>
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>{lawyer.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {lawyer.name}
                      </Text>
                      <Text style={{ fontSize: FontSize.xxs, color: colors.textSecondary }}>
                        {lawyer.firm_name || 'Independent Practice'}
                      </Text>
                      <Text style={{ fontSize: FontSize.xxs, color: colors.textLight, marginTop: 2 }}>
                        {lawyer.years_of_exp} years exp · {lawyer.city}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {lawyer.specialization.slice(0, 3).map((spec: string, i: number) => (
                          <View key={i} style={styles.specBadge}>
                            <Text style={styles.specText}>{spec}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} style={{ alignSelf: 'center', marginLeft: 8 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Consult AI Button Floating at Bottom */}
        <TouchableOpacity
          style={[styles.consultAiButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            router.push({
              pathname: '/(tabs)/assistant',
              params: {
                initialMessage: `I have a question about ${selectedCategory}. Can you explain the main provisions and guidelines?`
              }
            });
          }}
        >
          <Ionicons name="bulb-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: FontSize.sm }}>CONSULT AI</Text>
        </TouchableOpacity>

        {/* Details Modal */}
        {selectedStatute && (
          <Modal
            visible={!!selectedStatute}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setSelectedStatute(null)}
          >
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedStatute.section}</Text>
                  <TouchableOpacity onPress={() => setSelectedStatute(null)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: Spacing.lg, maxHeight: 400 }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>{selectedStatute.act_name}</Text>
                  <Text style={{ fontSize: 16, color: colors.text, fontWeight: '700', marginTop: 4 }}>
                    {selectedStatute.title}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12, lineHeight: 20 }}>
                    {selectedStatute.description}
                  </Text>
                </ScrollView>
                <View style={{ padding: Spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Button
                    title="Close"
                    onPress={() => setSelectedStatute(null)}
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {!selectedCategory ? (
        <>
          <Header
            title="Other Law & Acts"
            subtitle="Explore Civil, Family, Cyber, State Laws..."
            showBack
            onBack={() => router.back()}
          />

          <ScrollView contentContainerStyle={styles.listContent}>
            <View style={styles.grid}>
              {otherCategories.map((cat, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.gridCard, { width: (windowWidth - Spacing.xl * 2 - Spacing.md) / 2 - 2, backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedCategory(cat.name)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                    <View style={[styles.iconBox, { backgroundColor: cat.color + '15', marginBottom: 0 }]}>
                      <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    {cat.count && (
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: cat.color + '18' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: cat.color }}>{cat.count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.gridCardTitle, { color: colors.text }]}>{cat.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 16 }}>{cat.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </>
      ) : (
        renderCategoryDetail()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
  },

  // Grid list
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  gridCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  gridCardTitle: {
    fontWeight: '700',
    fontSize: FontSize.md,
    marginBottom: 4,
  },

  // Category view tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 48,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  // Search
  searchContainer: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },

  // Cards
  itemCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  subcatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subcatText: {
    fontSize: 9,
    fontWeight: '600',
  },

  // Lawyers list items
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specText: {
    fontSize: 9,
    color: '#3B82F6',
  },

  // Floating button
  consultAiButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // Filter Pills
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
