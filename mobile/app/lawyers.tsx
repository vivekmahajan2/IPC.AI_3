import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import api from '../lib/api';
import Header from '../components/ui/Header';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { Lawyer } from '../types';

interface CaseNote {
  id: number;
  case_title: string;
  court_name?: string;
  case_number?: string;
  sections_involved?: string[];
  client_name?: string;
  notes_content: string;
  hearing_date?: string;
  created_at: string;
  updated_at: string;
}

interface Bookmark {
  id: number;
  item_type: string;
  item_id?: string;
  title: string;
  citation?: string;
  notes?: string;
  created_at: string;
}

export default function LawyersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'directory' | 'notes' | 'bookmarks'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Case Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCourt, setNoteCourt] = useState('');
  const [noteNumber, setNoteNumber] = useState('');
  const [noteSections, setNoteSections] = useState('');
  const [noteClient, setNoteClient] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Bookmark Modal State
  const [isBmModalOpen, setIsBmModalOpen] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmCitation, setBmCitation] = useState('');
  const [bmType, setBmType] = useState('judgment');
  const [bmNotes, setBmNotes] = useState('');

  // 1. Fetch Lawyers Directory
  const { data: lawyers, isLoading: isLawyersLoading, isError: isLawyersError } = useQuery({
    queryKey: ['lawyers', searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      const res = await api.get('/lawyers', { params });
      return res.data as Lawyer[];
    },
    enabled: activeTab === 'directory',
  });

  // 2. Fetch Case Notes
  const { data: caseNotes, isLoading: isNotesLoading, refetch: refetchNotes } = useQuery({
    queryKey: ['case-notes'],
    queryFn: async () => {
      const res = await api.get('/lawyer/notes');
      return res.data as CaseNote[];
    },
    enabled: activeTab === 'notes',
  });

  // 3. Fetch Bookmarks
  const { data: bookmarks, isLoading: isBookmarksLoading, refetch: refetchBookmarks } = useQuery({
    queryKey: ['lawyer-bookmarks'],
    queryFn: async () => {
      const res = await api.get('/lawyer/bookmarks');
      return res.data as Bookmark[];
    },
    enabled: activeTab === 'bookmarks',
  });

  // Create Note Mutation
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const sections = noteSections
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return await api.post('/lawyer/notes', {
        case_title: noteTitle,
        court_name: noteCourt,
        case_number: noteNumber,
        sections_involved: sections,
        client_name: noteClient,
        hearing_date: noteDate,
        notes_content: noteContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-notes'] });
      setIsNoteModalOpen(false);
      setNoteTitle('');
      setNoteCourt('');
      setNoteNumber('');
      setNoteSections('');
      setNoteClient('');
      setNoteDate('');
      setNoteContent('');
      Alert.alert('Success', 'Case note saved to your legal diary.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save note');
    },
  });

  // Delete Note Mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await api.delete(`/lawyer/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-notes'] });
      Alert.alert('Deleted', 'Case note removed.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete note');
    },
  });

  // Create Bookmark Mutation
  const createBmMutation = useMutation({
    mutationFn: async () => {
      return await api.post('/lawyer/bookmarks', {
        title: bmTitle,
        citation: bmCitation,
        item_type: bmType,
        notes: bmNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-bookmarks'] });
      setIsBmModalOpen(false);
      setBmTitle('');
      setBmCitation('');
      setBmNotes('');
      Alert.alert('Saved', 'Precedent citation bookmarked.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save bookmark');
    },
  });

  // Delete Bookmark Mutation
  const deleteBmMutation = useMutation({
    mutationFn: async (id: number) => {
      return await api.delete(`/lawyer/bookmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-bookmarks'] });
      Alert.alert('Removed', 'Bookmark removed from list.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove bookmark');
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        title="Advocate Hub"
        subtitle="Directory, Case Diary & Precedents"
        showBack
        onBack={() => router.back()}
      />

      {/* Top Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'directory' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('directory')}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'directory' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, { color: activeTab === 'directory' ? colors.primary : colors.textSecondary }]}>
            Directory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'notes' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('notes')}
        >
          <Ionicons
            name="journal"
            size={16}
            color={activeTab === 'notes' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, { color: activeTab === 'notes' ? colors.primary : colors.textSecondary }]}>
            Case Diary
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bookmarks' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Ionicons
            name="bookmark"
            size={16}
            color={activeTab === 'bookmarks' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, { color: activeTab === 'bookmarks' ? colors.primary : colors.textSecondary }]}>
            Precedents
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: LAWYER DIRECTORY */}
      {activeTab === 'directory' && (
        <>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Input
              placeholder="Search by name, specialization, court, city..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              icon={<Ionicons name="search" size={18} color={colors.textLight} />}
              containerStyle={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {isLawyersLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading advocates...</Text>
              </View>
            )}

            {isLawyersError && (
              <Card style={styles.errorCard}>
                <Ionicons name="warning-outline" size={24} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>
                  Failed to load lawyer directory. Please try again.
                </Text>
              </Card>
            )}

            {!isLawyersLoading && !isLawyersError && lawyers?.length === 0 && (
              <EmptyState
                icon="people-outline"
                title="No Lawyers Found"
                message={
                  searchQuery.trim()
                    ? `No lawyers found for "${searchQuery}". Try different keywords.`
                    : 'No lawyers available at the moment.'
                }
              />
            )}

            {lawyers &&
              lawyers.map((lawyer) => {
                const isExpanded = expandedId === lawyer.id;
                return (
                  <TouchableOpacity
                    key={lawyer.id}
                    activeOpacity={0.8}
                    onPress={() => toggleExpand(lawyer.id)}
                  >
                    <Card style={[styles.lawyerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.lawyerHeader}>
                        <View style={[styles.avatarContainer, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {lawyer.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.lawyerInfo}>
                          <View style={styles.nameRow}>
                            <Text style={[styles.lawyerName, { color: colors.text }]} numberOfLines={1}>
                              {lawyer.name}
                            </Text>
                            {lawyer.is_verified && (
                              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                            )}
                          </View>
                          {lawyer.firm_name && (
                            <Text style={[styles.firmName, { color: colors.textSecondary }]} numberOfLines={1}>
                              {lawyer.firm_name}
                            </Text>
                          )}
                          {lawyer.years_of_exp != null && (
                            <Text style={[styles.experience, { color: colors.textLight }]}>
                              {lawyer.years_of_exp} years experience
                            </Text>
                          )}
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textLight}
                        />
                      </View>

                      {lawyer.specialization.length > 0 && (
                        <View style={styles.tagsRow}>
                          {lawyer.specialization.slice(0, 3).map((spec) => (
                            <View key={spec} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                              <Text style={[styles.tagText, { color: colors.primary }]}>{spec}</Text>
                            </View>
                          ))}
                          {lawyer.specialization.length > 3 && (
                            <View style={[styles.tag, styles.tagMore, { backgroundColor: colors.surfaceAlt }]}>
                              <Text style={[styles.tagText, styles.tagMoreText, { color: colors.textSecondary }]}>
                                +{lawyer.specialization.length - 3}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {lawyer.practicing_courts.length > 0 && (
                        <View style={styles.courtsRow}>
                          <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                          <Text style={[styles.courtsText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {lawyer.practicing_courts.join(', ')}
                          </Text>
                        </View>
                      )}

                      {isExpanded && (
                        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                          {lawyer.city && (
                            <View style={styles.detailRow}>
                              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                {lawyer.address ? `${lawyer.address}, ${lawyer.city}` : lawyer.city}
                              </Text>
                            </View>
                          )}
                          {lawyer.bar_council_id && (
                            <View style={styles.detailRow}>
                              <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
                              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                Bar Council: {lawyer.bar_council_id}
                              </Text>
                            </View>
                          )}
                          <View style={styles.contactActions}>
                            {lawyer.phone && (
                              <TouchableOpacity
                                style={[styles.contactButton, { borderColor: colors.primary }]}
                                onPress={() => Linking.openURL(`tel:${lawyer.phone}`)}
                              >
                                <Ionicons name="call" size={16} color={colors.primary} />
                                <Text style={[styles.contactButtonText, { color: colors.primary }]}>Call</Text>
                              </TouchableOpacity>
                            )}
                            {lawyer.email && (
                              <TouchableOpacity
                                style={[styles.contactButton, { borderColor: colors.primary }]}
                                onPress={() => Linking.openURL(`mailto:${lawyer.email}`)}
                              >
                                <Ionicons name="mail" size={16} color={colors.primary} />
                                <Text style={[styles.contactButtonText, { color: colors.primary }]}>Email</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </Card>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </>
      )}

      {/* TAB 2: CASE NOTES DIARY */}
      {activeTab === 'notes' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Trial & Case Diary</Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Confidential notes for hearings, witness cross-examinations</Text>
            </View>
            <TouchableOpacity
              style={[styles.primarySmallButton, { backgroundColor: colors.primary }]}
              onPress={() => setIsNoteModalOpen(true)}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primarySmallButtonText}>Add Note</Text>
            </TouchableOpacity>
          </View>

          {isNotesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : !caseNotes || caseNotes.length === 0 ? (
            <EmptyState
              icon="journal-outline"
              title="No Case Notes"
              message="Create confidential case notes for your trial proceedings and court hearings."
            />
          ) : (
            caseNotes.map((note) => (
              <Card key={note.id} style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.noteCaseTitle, { color: colors.text }]}>{note.case_title}</Text>
                    {note.case_number && (
                      <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                        Case No: {note.case_number}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Delete Note', 'Are you sure you want to delete this case note?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteNoteMutation.mutate(note.id) },
                      ]);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>

                {/* Meta details */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                  {note.court_name && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="business-outline" size={13} color={colors.textLight} />
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>{note.court_name}</Text>
                    </View>
                  )}
                  {note.client_name && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="person-outline" size={13} color={colors.textLight} />
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Client: {note.client_name}</Text>
                    </View>
                  )}
                  {note.hearing_date && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={13} color={colors.secondary} />
                      <Text style={{ fontSize: FontSize.xs, color: colors.secondary, fontWeight: '600' }}>
                        Hearing: {note.hearing_date}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Sections involved */}
                {note.sections_involved && note.sections_involved.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {note.sections_involved.map((s, idx) => (
                      <View key={idx} style={[styles.sectionTag, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        <Text style={[styles.sectionTagText, { color: colors.textSecondary }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Content */}
                <View style={[styles.noteContentBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.noteContentText, { color: colors.text }]}>{note.notes_content}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* TAB 3: BOOKMARKED PRECEDENTS */}
      {activeTab === 'bookmarks' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Bookmarked Precedents</Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Saved judgments, statutory rulings and case citations</Text>
            </View>
            <TouchableOpacity
              style={[styles.primarySmallButton, { backgroundColor: colors.primary }]}
              onPress={() => setIsBmModalOpen(true)}
            >
              <Ionicons name="bookmark" size={16} color="#FFFFFF" />
              <Text style={styles.primarySmallButtonText}>Save Citation</Text>
            </TouchableOpacity>
          </View>

          {isBookmarksLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : !bookmarks || bookmarks.length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title="No Saved Precedents"
              message="Bookmark landmark judgments, ratios, and statutory provisions for quick courtroom reference."
            />
          ) : (
            bookmarks.map((bm) => (
              <Card key={bm.id} style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.noteCaseTitle, { color: colors.text }]}>{bm.title}</Text>
                    {bm.citation && (
                      <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: '700', marginTop: 2 }}>
                        Citation: {bm.citation}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Remove Bookmark', 'Remove this precedent from bookmarks?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => deleteBmMutation.mutate(bm.id) },
                      ]);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>

                {bm.notes && (
                  <View style={[styles.noteContentBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, marginTop: 8 }]}>
                    <Text style={[styles.noteContentText, { color: colors.textSecondary }]}>{bm.notes}</Text>
                  </View>
                )}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* CREATE CASE NOTE MODAL */}
      <Modal visible={isNoteModalOpen} transparent animationType="slide" onRequestClose={() => setIsNoteModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.formModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Add Case Note</Text>
              <TouchableOpacity onPress={() => setIsNoteModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Input
                label="Case Title *"
                placeholder="e.g. State v. Anand Verma"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />
              <Input
                label="Court Name"
                placeholder="e.g. Tis Hazari Sessions Court"
                value={noteCourt}
                onChangeText={setNoteCourt}
              />
              <Input
                label="Case / Petition Number"
                placeholder="e.g. Bail App No. 421/2026"
                value={noteNumber}
                onChangeText={setNoteNumber}
              />
              <Input
                label="Sections Involved (comma-separated)"
                placeholder="e.g. BNS 103, BNS 303, BNSS 482"
                value={noteSections}
                onChangeText={setNoteSections}
              />
              <Input
                label="Client Name"
                placeholder="e.g. Anand Verma"
                value={noteClient}
                onChangeText={setNoteClient}
              />
              <Input
                label="Next Hearing Date"
                placeholder="e.g. 2026-10-15"
                value={noteDate}
                onChangeText={setNoteDate}
              />
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Case & Argument Notes *</Text>
              <TextInput
                placeholder="Key arguments, contradictory statements, medical board citations..."
                placeholderTextColor={colors.textLight}
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                numberOfLines={4}
                style={[styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              />

              <Button
                title={createNoteMutation.isPending ? 'Saving...' : 'Save Case Note'}
                onPress={() => {
                  if (!noteTitle.trim() || !noteContent.trim()) {
                    Alert.alert('Required Fields', 'Please enter both Case Title and Case Notes.');
                    return;
                  }
                  createNoteMutation.mutate();
                }}
                disabled={createNoteMutation.isPending}
                fullWidth
                style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CREATE BOOKMARK MODAL */}
      <Modal visible={isBmModalOpen} transparent animationType="slide" onRequestClose={() => setIsBmModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.formModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Bookmark Precedent</Text>
              <TouchableOpacity onPress={() => setIsBmModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Input
                label="Precedent / Case Name *"
                placeholder="e.g. Arnesh Kumar v. State of Bihar"
                value={bmTitle}
                onChangeText={setBmTitle}
              />
              <Input
                label="Citation / Year *"
                placeholder="e.g. (2014) 8 SCC 273"
                value={bmCitation}
                onChangeText={setBmCitation}
              />
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Legal Ratio & Annotation Notes</Text>
              <TextInput
                placeholder="Key ratio: arrest guidelines for offences punishable up to 7 years..."
                placeholderTextColor={colors.textLight}
                value={bmNotes}
                onChangeText={setBmNotes}
                multiline
                numberOfLines={3}
                style={[styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              />

              <Button
                title={createBmMutation.isPending ? 'Saving...' : 'Bookmark Precedent'}
                onPress={() => {
                  if (!bmTitle.trim() || !bmCitation.trim()) {
                    Alert.alert('Required Fields', 'Please enter Case Name and Citation.');
                    return;
                  }
                  createBmMutation.mutate();
                }}
                disabled={createBmMutation.isPending}
                fullWidth
                style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  searchInput: {
    marginBottom: 0,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  primarySmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  primarySmallButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.errorLight,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
  },

  // Lawyer Card
  lawyerCard: {
    marginBottom: Spacing.md,
  },
  lawyerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.secondary,
  },
  lawyerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lawyerName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  firmName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  experience: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  tag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  tagMore: {
    backgroundColor: Colors.surfaceAlt,
  },
  tagMoreText: {
    color: Colors.textSecondary,
  },
  courtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  courtsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  expandedSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  detailText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  contactButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Case Note Cards
  noteCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  noteCaseTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  sectionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  sectionTagText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  noteContentBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  noteContentText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  formModalCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadow.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  multilineInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    minHeight: 90,
  },
});
