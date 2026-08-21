import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Switch,
  Modal,
  Image,
  Alert,
  Linking,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useTheme } from '../../context/ThemeContext';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import { FIRDraft } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { theme, isDark, colors, toggleTheme } = useTheme();
  const { fullSync, isSyncing, mappingsCached, downloadMappings } = useOfflineSync();

  const { width: windowWidth } = useWindowDimensions();

  // Dynamic layout calculations for responsiveness
  const getColumnsCount = (width: number) => {
    if (width > 768) return 4;
    if (width > 500) return 3;
    return 2;
  };

  const columnsCount = getColumnsCount(windowWidth);
  const cardWidth = (windowWidth - Spacing.lg * 2 - Spacing.md * (columnsCount - 1) - 4) / columnsCount;

  // Navigation states within Home
  const [screenState, setScreenState] = useState<'dashboard' | 'act-comparison' | 'court-registry' | 'bare-acts' | 'coi' | 'ai-helper'>('dashboard');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'advocate'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Helper states
  const [aiTitle, setAiTitle] = useState('AI Assistant');
  const [aiSubtitle, setAiSubtitle] = useState('');
  const [aiDescription, setAiDescription] = useState('');

  // UI interaction states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictQuery, setDictQuery] = useState('');
  const [dictResult, setDictResult] = useState<string | null>(null);

  // Form states for login/signup modal
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Drawer slide animation
  const drawerAnim = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    // Run offline sync and download mapping data if needed
    fullSync().catch(console.warn);
    if (!mappingsCached) {
      downloadMappings().catch(console.warn);
    }
  }, []);

  // Fetch FIRs query (used in background)
  const { data: firs, isLoading: isFirsLoading, refetch: refetchFirs } = useQuery({
    queryKey: ['firs-recent'],
    queryFn: async () => {
      try {
        const res = await api.get('/fir?limit=5');
        return res.data as FIRDraft[];
      } catch (err) {
        return [];
      }
    },
    enabled: isAuthenticated,
  });

  const toggleDrawer = (open: boolean) => {
    setIsDrawerOpen(open);
    Animated.timing(drawerAnim, {
      toValue: open ? 0 : -300,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleAuthAction = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all credentials.');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await login(email.trim(), password);
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        // Register API placeholder
        await api.post('/auth/register', {
          email: email.trim(),
          password,
          full_name: fullName.trim() || 'User',
          role: 'lawyer',
        });
        await login(email.trim(), password);
        Alert.alert('Success', 'Account created and logged in!');
      }
      setIsAuthModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Authentication failed. Please try again.';
      Alert.alert('Authentication Error', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Mock lawyers list for the Advocate tab
  const mockLawyers = [
    {
      id: 101,
      name: 'Angadl Ravi',
      specialization: 'Succession Certificate',
      experience: '27+ years experience',
      location: 'Ballari',
      verified: true,
    },
    {
      id: 102,
      name: 'Prashant Kumar Mishra',
      specialization: 'Criminal Law & Procedure',
      experience: '33+ years experience',
      location: 'Kanpur Dehat',
      verified: true,
    },
    {
      id: 103,
      name: 'Vishal T Lokhande',
      specialization: 'Criminal Defense',
      experience: '14+ years experience',
      location: 'Mumbai CityCivil Court',
      verified: true,
    },
    {
      id: 104,
      name: 'Nisar Ahmed',
      specialization: 'Criminal & IPC',
      experience: '4+ years experience',
      location: 'Kushinagar',
      verified: true,
    },
    {
      id: 105,
      name: 'Rakesh Upadhyay',
      specialization: 'Civil & Corporate',
      experience: '5+ years experience',
      location: 'Central Delhi',
      verified: true,
    },
    {
      id: 106,
      name: 'Ajay Thakur',
      specialization: 'Divorce & Family Law',
      experience: '14+ years experience',
      location: 'Dewas',
      verified: true,
    },
  ];

  // Mock legal dictionary words
  const legalDictionary: Record<string, string> = {
    affidavit: 'A written statement confirmed by oath or affirmation, for use as evidence in court.',
    bail: 'The temporary release of an accused person awaiting trial, sometimes on condition that a sum of money is lodged to guarantee their appearance in court.',
    cognizable: 'An offense in which a police officer has the authority to make an arrest without a warrant.',
    sanhita: 'A compilation of laws or statutes, used to refer to the new criminal codes (e.g., Bharatiya Nyaya Sanhita).',
    fir: 'First Information Report, a document prepared by police organizations when they receive information about the commission of a cognizable offense.',
    injunction: 'A judicial order that restrains a person from beginning or continuing an action threatening or invading the legal right of another.',
    habeas: 'A writ requiring a person under arrest to be brought before a judge or into court, especially to secure their release unless lawful grounds are shown.',
  };

  const handleSearchDictionary = () => {
    const term = dictQuery.toLowerCase().trim();
    if (legalDictionary[term]) {
      setDictResult(legalDictionary[term]);
    } else {
      setDictResult(`Definition for "${dictQuery}" not found. Try search terms like: FIR, cognizable, bail, sanhita.`);
    }
  };

  const handleContactLawyer = (lawyerName: string) => {
    Alert.alert('Contacting Advocate', `Initiating contact request with ${lawyerName}...`);
  };

  // Render Sub-Screen: Act Comparison
  const renderActComparison = () => {
    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        <View style={styles.subScreenHeader}>
          <TouchableOpacity onPress={() => setScreenState('dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.subScreenTitle, { color: colors.text }]}>ACT COMPARISON</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.subScreenScrollContent}>
          {/* BNS v/s IPC */}
          <Card style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.comparisonCardTitle, { color: colors.text }]}>BNS v/s IPC</Text>
            <View style={styles.comparisonRow}>
              <TouchableOpacity
                style={[styles.comparisonBadgeNew, { backgroundColor: '#7C3AED' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=BNS');
                }}
              >
                <Text style={styles.badgeMiniText}>NEW</Text>
                <Text style={styles.badgeBigText}>BNS</Text>
              </TouchableOpacity>
              <Text style={[styles.vsText, { color: colors.textSecondary }]}>vs</Text>
              <TouchableOpacity
                style={[styles.comparisonBadgeOld, { borderColor: '#7C3AED' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=IPC');
                }}
              >
                <Text style={[styles.badgeMiniTextOld, { color: '#7C3AED' }]}>OLD</Text>
                <Text style={[styles.badgeBigTextOld, { color: '#7C3AED' }]}>IPC</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* BNSS v/s CrPC */}
          <Card style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.comparisonCardTitle, { color: colors.text }]}>BNSS v/s CrPC</Text>
            <View style={styles.comparisonRow}>
              <TouchableOpacity
                style={[styles.comparisonBadgeNew, { backgroundColor: '#059669' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=BNSS');
                }}
              >
                <Text style={styles.badgeMiniText}>NEW</Text>
                <Text style={styles.badgeBigText}>BNSS</Text>
              </TouchableOpacity>
              <Text style={[styles.vsText, { color: colors.textSecondary }]}>vs</Text>
              <TouchableOpacity
                style={[styles.comparisonBadgeOld, { borderColor: '#059669' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=CrPC');
                }}
              >
                <Text style={[styles.badgeMiniTextOld, { color: '#059669' }]}>OLD</Text>
                <Text style={[styles.badgeBigTextOld, { color: '#059669' }]}>CrPC</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* BSA v/s IEA */}
          <Card style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.comparisonCardTitle, { color: colors.text }]}>BSA v/s IEA</Text>
            <View style={styles.comparisonRow}>
              <TouchableOpacity
                style={[styles.comparisonBadgeNew, { backgroundColor: '#D97706' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=BSA');
                }}
              >
                <Text style={styles.badgeMiniText}>NEW</Text>
                <Text style={styles.badgeBigText}>BSA</Text>
              </TouchableOpacity>
              <Text style={[styles.vsText, { color: colors.textSecondary }]}>vs</Text>
              <TouchableOpacity
                style={[styles.comparisonBadgeOld, { borderColor: '#D97706' }]}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push('/bare-act?act=IEA');
                }}
              >
                <Text style={[styles.badgeMiniTextOld, { color: '#D97706' }]}>OLD</Text>
                <Text style={[styles.badgeBigTextOld, { color: '#D97706' }]}>IEA</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </View>
    );
  };

  // Render Sub-Screen: Court Registry
  const renderCourtRegistry = () => {
    const courtsList = [
      'Supreme Court of India',
      'Supreme Court - Daily Orders',
      'Allahabad High Court',
      'Andhra Pradesh High Court',
      'Bombay High Court',
      'Chattisgarh High Court',
      'Madras High Court',
      'Delhi High Court',
      'Delhi High Court - Orders',
      'Gauhati High Court',
      'Gujarat High Court',
    ];

    const filteredCourts = courtsList.filter((court) =>
      court.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        <View style={styles.subScreenHeader}>
          <TouchableOpacity onPress={() => setScreenState('dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.subScreenTitle, { color: colors.text }]}>Court Registry</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchBarContainer}>
          <TextInput
            placeholder="Search Registry..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.registrySearchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.subScreenScrollContent}>
          {filteredCourts.map((court, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.courtItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                setScreenState('dashboard');
                router.push('/judgments');
              }}
            >
              <View style={styles.courtItemLeft}>
                <View style={[styles.courtIconContainer, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.courtItemText, { color: colors.text }]}>{court}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Floating search judgment button */}
        <TouchableOpacity
          style={styles.floatingSearchJudgments}
          onPress={() => {
            setScreenState('dashboard');
            router.push('/judgments');
          }}
        >
          <Ionicons name="search" size={18} color="#FFFFFF" />
          <Text style={styles.floatingSearchJudgmentsText}>Search Judgment</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Sub-Screen: COI (Constitution of India)
  const renderCOI = () => {
    const coiParts = [
      { part: 'Preamble', title: 'Preamble to the Constitution', range: 'Preamble' },
      { part: 'Part I', title: 'The Union and its Territory', range: 'Articles 1-4' },
      { part: 'Part II', title: 'Citizenship', range: 'Articles 5-11' },
      { part: 'Part III', title: 'Fundamental Rights', range: 'Articles 12-35' },
      { part: 'Part IV', title: 'Directive Principles of State Policy', range: 'Articles 36-51' },
      { part: 'Part IVA', title: 'Fundamental Duties', range: 'Article 51A' },
      { part: 'Part V', title: 'The Union', range: 'Articles 52-151' },
      { part: 'Part VI', title: 'The States', range: 'Articles 152-237' },
      { part: 'Part VIII', title: 'The Union Territories', range: 'Articles 239-242' },
      { part: 'Part IX', title: 'The Panchayats', range: 'Articles 243-243O' },
      { part: 'Part IXA', title: 'The Municipalities', range: 'Articles 243P-243ZG' },
      { part: 'Part X', title: 'The Scheduled and Tribal Areas', range: 'Articles 244-244A' },
      { part: 'Part XI', title: 'Relations Between the Union and the States', range: 'Articles 245-263' },
      { part: 'Part XII', title: 'Finance, Property, Contracts and Suits', range: 'Articles 264-300A' },
      { part: 'Part XIII', title: 'Trade, Commerce and Intercourse', range: 'Articles 301-307' },
      { part: 'Part XIV', title: 'Services Under the Union and the States', range: 'Articles 308-323' },
      { part: 'Part XIVA', title: 'Tribunals', range: 'Articles 323A-323B' },
      { part: 'Part XV', title: 'Elections', range: 'Articles 324-329A' },
      { part: 'Part XVI', title: 'Special Provisions Relating to Certain Classes', range: 'Articles 330-342' },
      { part: 'Part XVII', title: 'Official Language', range: 'Articles 343-351' },
      { part: 'Part XVIII', title: 'Emergency Provisions', range: 'Articles 352-360' },
      { part: 'Part XIX', title: 'Miscellaneous', range: 'Articles 361-367' },
      { part: 'Part XX', title: 'Amendment of the Constitution', range: 'Article 368' },
      { part: 'Part XXI', title: 'Temporary, Transitional and Special Provisions', range: 'Articles 369-392' },
      { part: 'Part XXII', title: 'Short Title, Commencement, Hindi Text & Repeals', range: 'Articles 393-395' },
    ];

    const filteredParts = coiParts.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.part.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        <View style={styles.subScreenHeader}>
          <TouchableOpacity onPress={() => { setScreenState('dashboard'); setSearchQuery(''); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.subScreenTitle, { color: colors.text, fontSize: FontSize.lg }]}>Constitution of India</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchBarContainer}>
          <TextInput
            placeholder="Search Articles or Parts..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.registrySearchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.subScreenScrollContent}>
          {filteredParts.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.courtItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                setAiTitle(item.part);
                setAiSubtitle(item.title);
                setAiDescription(`Articles range: ${item.range}.\n\nThis section describes the constitutional framework, provisions, and legal guidelines regarding ${item.title.toLowerCase()} in India.`);
                setScreenState('ai-helper');
                setSearchQuery('');
              }}
            >
              <View style={styles.courtItemLeft}>
                <View style={[styles.courtIconContainer, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                </View>
                <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  <Text style={[styles.courtItemText, { color: colors.text, fontWeight: '700' }]}>{item.part}</Text>
                  <Text style={[styles.utilityLabel, { color: colors.textSecondary, fontSize: FontSize.xxs }]}>{item.title}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: Spacing.sm }}>
                <Text style={{ fontSize: 10, color: colors.textLight }}>{item.range}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render Sub-Screen: Bare Acts Library
  const renderBareActs = () => {
    const listItems = [
      {
        title: 'Bharatiya Nyaya Sanhita (BNS)',
        sub: 'New Penal Code',
        icon: 'book-outline',
        iconBg: 'rgba(124, 58, 237, 0.1)',
        iconColor: '#7C3AED',
        action: () => {
          router.push('/bare-act?act=BNS');
        }
      },
      {
        title: 'Indian Penal Code (IPC)',
        sub: 'Old Penal Code',
        icon: 'book-outline',
        iconBg: 'rgba(124, 58, 237, 0.1)',
        iconColor: '#7C3AED',
        action: () => {
          router.push('/bare-act?act=IPC');
        }
      },
      {
        title: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)',
        sub: 'New Criminal Procedure Code',
        icon: 'book-outline',
        iconBg: 'rgba(5, 150, 105, 0.1)',
        iconColor: '#059669',
        action: () => {
          router.push('/bare-act?act=BNSS');
        }
      },
      {
        title: 'Code of Criminal Procedure (CrPC)',
        sub: 'Old Criminal Procedure Code',
        icon: 'book-outline',
        iconBg: 'rgba(5, 150, 105, 0.1)',
        iconColor: '#059669',
        action: () => {
          router.push('/bare-act?act=CrPC');
        }
      },
      {
        title: 'Bharatiya Sakshya Adhiniyam (BSA)',
        sub: 'New Indian Evidence Act',
        icon: 'book-outline',
        iconBg: 'rgba(217, 119, 6, 0.1)',
        iconColor: '#D97706',
        action: () => {
          router.push('/bare-act?act=BSA');
        }
      },
      {
        title: 'Indian Evidence Act (IEA)',
        sub: 'Old Indian Evidence Act',
        icon: 'book-outline',
        iconBg: 'rgba(217, 119, 6, 0.1)',
        iconColor: '#D97706',
        action: () => {
          router.push('/bare-act?act=IEA');
        }
      },
      {
        title: 'Indian States Law',
        sub: 'Contains all state law of India',
        icon: 'map-outline',
        iconBg: 'rgba(245, 158, 11, 0.1)',
        iconColor: '#F59E0B',
        action: () => Alert.alert('Indian States Law', 'Opening database of Indian State-level acts...')
      },
      {
        title: 'Other Law',
        sub: 'Civil, Family, Commercial, Cyber, Labour, State, Tax, Food Laws',
        icon: 'briefcase-outline',
        iconBg: 'rgba(124, 58, 237, 0.1)',
        iconColor: '#7C3AED',
        action: () => router.push('/other-law')
      },

      {
        title: 'Supreme Court Rules, 2013',
        sub: 'Supreme Court Rules and Guidelines',
        icon: 'hammer-outline',
        iconBg: 'rgba(59, 130, 246, 0.1)',
        iconColor: '#3B82F6',
        action: () => Alert.alert('Supreme Court Rules, 2013', 'Official handbook of Supreme Court regulations.')
      },
      {
        title: 'Practice and Procedure of Supreme Court',
        sub: 'How the Supreme Court Works',
        icon: 'layers-outline',
        iconBg: 'rgba(99, 102, 241, 0.1)',
        iconColor: '#6366F1',
        action: () => Alert.alert('Practice & Procedure', 'Supreme court practice directives and procedural guidelines.')
      },
      {
        title: 'Law Dictionary',
        sub: 'Simplified Definitions of Legal Terms and Concepts',
        icon: 'text-outline',
        iconBg: 'rgba(239, 68, 68, 0.1)',
        iconColor: '#EF4444',
        action: () => setIsDictionaryOpen(true)
      }
    ];

    const quickRefs = [
      { label: 'Rules', icon: 'list-outline', color: '#3B82F6' },
      { label: 'Regulations', icon: 'shield-outline', color: '#10B981' },
      { label: 'Notification', icon: 'notifications-outline', color: '#EC4899' },
      { label: 'Orders', icon: 'document-text-outline', color: '#F59E0B' },
      { label: 'Ordinance', icon: 'ribbon-outline', color: '#8B5CF6' },
      { label: 'Circulars', icon: 'refresh-outline', color: '#06B6D4' }
    ];

    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        <View style={styles.subScreenHeader}>
          <TouchableOpacity onPress={() => setScreenState('dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.subScreenTitle, { color: colors.text, fontSize: FontSize.lg }]}>Bare Acts</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>On the basis of Indian Law</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Bookmarks', 'No bookmarked Bare Acts yet!')} style={styles.backButton}>
            <Ionicons name="bookmark" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.subScreenScrollContent} showsVerticalScrollIndicator={false}>
          {/* Main List Items */}
          <View style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
            {listItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.courtItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={item.action}
              >
                <View style={styles.courtItemLeft}>
                  <View style={[styles.courtIconContainer, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
                  </View>
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={[styles.courtItemText, { color: colors.text, fontWeight: '700' }]}>{item.title}</Text>
                    <Text style={[styles.utilityLabel, { color: colors.textSecondary, fontSize: FontSize.xxs }]}>{item.sub}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Reference Section */}
          <Text style={[styles.quickRefTitle, { color: colors.textSecondary }]}>QUICK REFERENCE</Text>
          <View style={styles.quickRefGrid}>
            {quickRefs.map((ref, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickRefButton,
                  { backgroundColor: colors.surface, borderLeftColor: ref.color, width: cardWidth }
                ]}
                onPress={() => Alert.alert(ref.label, `Browse legal ${ref.label.toLowerCase()} mappings...`)}
              >
                <Ionicons name={ref.icon as any} size={14} color={ref.color} style={{ marginRight: 6 }} />
                <Text style={[styles.quickRefText, { color: colors.text }]} numberOfLines={1}>{ref.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Repealed Acts Banner Card at Bottom */}
          <TouchableOpacity
            style={[styles.repealedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => Alert.alert('Repealed Acts', 'Browse historical and repealed laws of India.')}
          >
            <View style={[styles.courtIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', marginRight: Spacing.md }]}>
              <Ionicons name="book" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.courtItemText, { color: colors.text, fontWeight: '700' }]}>Repealed Acts</Text>
              <Text style={[styles.utilityLabel, { color: colors.textSecondary, fontSize: FontSize.xxs }]}>All Indian Repealed Acts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // Render Sub-Screen: AI Helper Page (Blank page with backward option)
  const renderAIHelper = () => {
    let iconName: any = 'bulb-outline';
    
    if (aiTitle === 'Judgment AI') {
      iconName = 'hammer-outline';
    } else if (aiTitle === 'Legal AI') {
      iconName = 'analytics-outline';
    } else if (aiTitle === 'Legal Advice') {
      iconName = 'chatbubbles-outline';
    } else {
      iconName = 'document-text-outline';
    }

    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        <View style={styles.subScreenHeader}>
          <TouchableOpacity onPress={() => setScreenState('dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.subScreenTitle, { color: colors.text, fontSize: FontSize.lg }]}>{aiTitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Spacing.lg
          }}>
            <Ionicons name={iconName} size={40} color={colors.primary} />
          </View>
          
          <Text style={{
            fontSize: FontSize.lg,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginBottom: Spacing.xs
          }}>
            {aiSubtitle}
          </Text>

          <Text style={{
            fontSize: FontSize.sm,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20
          }}>
            {aiDescription}
          </Text>
        </View>
      </View>
    );
  };

  // Main Render Logic
  if (screenState === 'act-comparison') return renderActComparison();
  if (screenState === 'court-registry') return renderCourtRegistry();
  if (screenState === 'bare-acts') return renderBareActs();
  if (screenState === 'coi') return renderCOI();
  if (screenState === 'ai-helper') return renderAIHelper();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => toggleDrawer(true)} style={styles.menuIconButton}>
          <Ionicons name="menu-outline" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Text style={[styles.logoTextMain, { color: colors.text }]}>IPC</Text>
          <Text style={styles.logoTextSub}>.AI</Text>
          <Text style={[styles.logoLawIndia, { color: colors.textSecondary }]}>Law of India</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsAuthModalOpen(true)}
          style={[styles.avatarButton, { borderColor: colors.primary }]}
        >
          <Text style={[styles.avatarButtonText, { color: colors.primary }]}>
            {isAuthenticated ? (user?.full_name || 'V').charAt(0).toUpperCase() : 'V'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'dashboard' && styles.tabButtonActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons
            name="grid"
            size={18}
            color={activeTab === 'dashboard' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, { color: activeTab === 'dashboard' ? colors.text : colors.textSecondary }]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'advocate' && styles.tabButtonActive]}
          onPress={() => setActiveTab('advocate')}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'advocate' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, { color: activeTab === 'advocate' ? colors.text : colors.textSecondary }]}>
            Advocate
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {activeTab === 'dashboard' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Core Bare Act / Sanhita Comparison Cards (2x2 Grid) */}
          <View style={styles.coreGrid}>
            <TouchableOpacity
              style={[styles.coreCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
              onPress={() => setScreenState('coi')}
            >
              <View style={styles.coreCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="business" size={20} color={colors.primary} />
                </View>
              </View>
              <Text style={[styles.coreCardTitle, { color: colors.text }]}>COI</Text>
              <Text style={[styles.coreCardSub, { color: colors.textSecondary }]}>The Constitution of India</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coreCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
              onPress={() => setScreenState('bare-acts')}
            >
              <View style={styles.coreCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="library" size={20} color={colors.error} />
                </View>
              </View>
              <Text style={[styles.coreCardTitle, { color: colors.text }]}>Bare Acts</Text>
              <Text style={[styles.coreCardSub, { color: colors.textSecondary }]}>Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coreCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
              onPress={() => setScreenState('act-comparison')}
            >
              <View style={styles.coreCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="git-compare" size={20} color={colors.warning} />
                </View>
              </View>
              <Text style={[styles.coreCardTitle, { color: colors.text }]}>New v/s Old</Text>
              <Text style={[styles.coreCardSub, { color: colors.textSecondary }]}>Comparison</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coreCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
              onPress={() => setScreenState('court-registry')}
            >
              <View style={styles.coreCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="hammer" size={20} color={colors.success} />
                </View>
              </View>
              <Text style={[styles.coreCardTitle, { color: colors.text }]}>Judgment</Text>
              <Text style={[styles.coreCardSub, { color: colors.textSecondary }]}>All Indian Judgments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coreCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
              onPress={() => router.push('/other-law')}
            >
              <View style={styles.coreCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(124, 58, 237, 0.1)' }]}>
                  <Ionicons name="briefcase" size={20} color="#7C3AED" />
                </View>
              </View>
              <Text style={[styles.coreCardTitle, { color: colors.text }]}>Other Law</Text>
              <Text style={[styles.coreCardSub, { color: colors.textSecondary }]}>Civil, Family, Cyber, State...</Text>
            </TouchableOpacity>
          </View>

          {/* Our Legal AI Tools Section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            <Ionicons name="bulb-outline" size={18} color={colors.primary} /> Our Legal AI Tools
          </Text>
          <View style={styles.aiToolsRow}>
            <TouchableOpacity
              style={[styles.aiToolCard, { backgroundColor: colors.surface }]}
              onPress={() => {
                setAiTitle('Judgment AI');
                setAiSubtitle('AI Precedent & Judgment Search');
                setAiDescription('Search landmark Indian judicial precedents by citation, court name, or keywords. This module will integrate with RAG search in the next phase.');
                setScreenState('ai-helper');
              }}
            >
              <View style={[styles.aiIconWrapper, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <Ionicons name="hammer-outline" size={24} color="#10B981" />
              </View>
              <Text style={[styles.aiToolLabel, { color: colors.text }]}>Judgment AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.aiToolCard, { backgroundColor: colors.surface }]}
              onPress={() => {
                setAiTitle('Legal AI');
                setAiSubtitle('AI Code Comparison & Statutes Assistant');
                setAiDescription('Bidirectional mapping and comparative analysis between old acts and new Sanhitas. This module will support dynamic LLM reasoning.');
                setScreenState('ai-helper');
              }}
            >
              <View style={[styles.aiIconWrapper, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Ionicons name="analytics" size={24} color="#3B82F6" />
              </View>
              <Text style={[styles.aiToolLabel, { color: colors.text }]}>Legal AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.aiToolCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/(tabs)/fir/new')}
            >
              <View style={[styles.aiIconWrapper, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                <Ionicons name="document-text-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.aiToolLabel, { color: colors.text }]}>Draft AI</Text>
            </TouchableOpacity>
          </View>

          {/* Tools & Utilities Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            <Ionicons name="apps-outline" size={18} color={colors.primary} /> Tools & Utilities
          </Text>
          <View style={styles.utilitiesGrid}>
            {[
              {
                label: 'Legal advice',
                icon: 'chatbubbles-outline',
                action: () => {
                  setAiTitle('Legal Advice');
                  setAiSubtitle('Legal Query & Advice Assistant');
                  setAiDescription('Receive guidance on legal issues, FIR drafting, and relevant sections. This module will use LLM-based chat interactions.');
                  setScreenState('ai-helper');
                }
              },
              { label: 'Drafting', icon: 'create-outline', route: '/(tabs)/fir' },
              { label: 'Daily Poll', icon: 'stats-chart-outline', action: () => Alert.alert('Poll', 'Today\'s Poll: Will the new BNS code improve speed of investigation? Vote in dashboard.') },
              { label: 'Play Quiz', icon: 'ribbon-outline', action: () => Alert.alert('Legal Quiz', 'Start our 5-minute legal quiz on new IPC/BNS mappings!') },
            ].map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.utilityCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
                onPress={() => {
                  if (item.route) router.push(item.route as any);
                  else if (item.action) item.action();
                }}
              >
                <View style={styles.utilityLeft}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} style={{ marginRight: Spacing.sm }} />
                  <Text style={[styles.utilityLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>

        </ScrollView>
      ) : (
        /* Advocate Tab Content */
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.advocatesHeader}>
            <Text style={[styles.advocateTitleText, { color: colors.text }]}>Top Advocates</Text>
            <TouchableOpacity onPress={() => router.push('/lawyers')}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Advocates Grid */}
          <View style={styles.advocatesGrid}>
            {mockLawyers.map((lawyer) => (
              <Card key={lawyer.id} style={[styles.advocateCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}>
                <View style={styles.advocateProfileWrapper}>
                  <View style={[styles.advocatePhotoContainer, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.photoText, { color: colors.primary }]}>
                      {lawyer.name.charAt(0)}
                    </Text>
                    {lawyer.verified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                      </View>
                    )}
                  </View>
                </View>

                <Text style={[styles.advocateName, { color: colors.text }]} numberOfLines={1}>
                  {lawyer.name}
                </Text>
                <Text style={[styles.advocateSpecialization, { color: colors.textSecondary }]} numberOfLines={1}>
                  {lawyer.specialization}
                </Text>
                <Text style={[styles.advocateExp, { color: colors.textLight }]}>
                  {lawyer.experience}
                </Text>

                <View style={styles.advocateLocationRow}>
                  <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.advocateLocationText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {lawyer.location}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.contactNowButton, { backgroundColor: colors.primaryLight }]}
                  onPress={() => handleContactLawyer(lawyer.name)}
                >
                  <Text style={[styles.contactNowButtonText, { color: colors.primary }]}>Contact Now</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>

          {/* Floating actions for Advocate section */}
          <View style={styles.advocateFloatingButtons}>
            <TouchableOpacity
              style={[styles.expertsButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/lawyers')}
            >
              <Ionicons name="people" size={16} color="#FFFFFF" />
              <Text style={styles.expertsButtonText}>FIND MORE EXPERTS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dictionaryFloatButton, { backgroundColor: '#3B82F6' }]}
              onPress={() => setIsDictionaryOpen(true)}
            >
              <Ionicons name="book" size={16} color="#FFFFFF" />
              <Text style={styles.expertsButtonText}>Law Dictionary</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Floating law dictionary action on home page dashboard */}
      {activeTab === 'dashboard' && (
        <TouchableOpacity
          style={styles.floatingDictionaryIcon}
          onPress={() => setIsDictionaryOpen(true)}
        >
          <Ionicons name="book" size={24} color="#FFFFFF" />
          <View style={styles.redDot} />
        </TouchableOpacity>
      )}

      {/* Side Drawer Component Overlay */}
      {isDrawerOpen && (
        <TouchableOpacity
          style={styles.drawerBackdrop}
          activeOpacity={1}
          onPress={() => toggleDrawer(false)}
        >
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                backgroundColor: isDark ? '#141416' : '#FFFFFF',
                transform: [{ translateX: drawerAnim }],
              },
            ]}
          >
            {/* Drawer Profile Header */}
            <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.drawerHeaderRow}>
                <View style={[styles.drawerAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.drawerAvatarText}>V</Text>
                </View>
                <View style={styles.drawerHeaderInfo}>
                  <Text style={[styles.drawerName, { color: colors.text }]}>Vivek Mahajan</Text>
                  <Text style={[styles.drawerEmail, { color: colors.textSecondary }]}>vivekmahajan045@gmail.com</Text>
                </View>
                <TouchableOpacity onPress={() => fullSync().catch(console.warn)}>
                  <Ionicons name="sync-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>


            </View>

            {/* Drawer Options Scroll */}
            <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
              
              {/* Preferences */}
              <Text style={[styles.drawerSectionHeader, { color: colors.textSecondary }]}>PREFERENCES</Text>
              
              <View style={styles.drawerItemRow}>
                <View style={styles.drawerItemLeft}>
                  <Ionicons name="sunny-outline" size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.drawerItemText, { color: colors.text }]}>Night Mode</Text>
                </View>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: '#3B82F6' }}
                  thumbColor={theme === 'dark' ? '#FFFFFF' : '#f4f3f4'}
                />
              </View>

              <TouchableOpacity style={styles.drawerItemRow}>
                <View style={styles.drawerItemLeft}>
                  <Ionicons name="language-outline" size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.drawerItemText, { color: colors.text }]}>App Language</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>

              {/* Favourite */}
              <Text style={[styles.drawerSectionHeader, { color: colors.textSecondary }]}>FAVOURITE</Text>

              {[
                { title: 'Bare Acts', icon: 'folder-outline' },
                { title: 'Bare Act Sections', icon: 'folder-outline' },
                { title: 'COI Articles', icon: 'folder-outline' },
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.drawerItemRow} onPress={() => { toggleDrawer(false); router.push('/(tabs)/converter'); }}>
                  <View style={styles.drawerItemLeft}>
                    <Ionicons name={item.icon as any} size={20} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={[styles.drawerItemText, { color: colors.text }]}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Support & Others */}
              <Text style={[styles.drawerSectionHeader, { color: colors.textSecondary }]}>SUPPORT & OTHERS</Text>

              {[
                { title: 'Contact Us', icon: 'headset-outline', action: () => Alert.alert('Support', 'Email us at support@ipc.ai') },
                { title: 'AboutUs', icon: 'information-circle-outline', action: () => Alert.alert('About', 'IPC.AI is an AI-powered legal platform for Indian Police, Public and Lawyers.') },
                { title: 'Rate our Service', icon: 'star-outline', action: () => Alert.alert('Rate', 'Thanks for supporting IPC.AI!') },
                { title: 'Privacy Policy', icon: 'shield-checkmark-outline', action: () => Linking.openURL('https://ipc.ai/privacy') },
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.drawerItemRow} onPress={item.action}>
                  <View style={styles.drawerItemLeft}>
                    <Ionicons name={item.icon as any} size={20} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={[styles.drawerItemText, { color: colors.text }]}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Logout */}
              {isAuthenticated && (
                <TouchableOpacity
                  style={[styles.drawerItemRow, { marginTop: 20 }]}
                  onPress={async () => {
                    await logout();
                    toggleDrawer(false);
                    Alert.alert('Logged Out', 'You have been logged out.');
                  }}
                >
                  <View style={styles.drawerItemLeft}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                    <Text style={[styles.drawerItemText, { color: '#EF4444' }]}>Sign Out</Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Auth Modal (Login / Signup) */}
      <Modal
        visible={isAuthModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAuthModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {authMode === 'login' ? 'Sign In to IPC.ai' : 'Create Account'}
              </Text>
              <TouchableOpacity onPress={() => setIsAuthModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {authMode === 'signup' && (
              <Input
                label="Full Name"
                placeholder="Vivek Mahajan"
                value={fullName}
                onChangeText={setFullName}
                icon={<Ionicons name="person-outline" size={18} color={colors.textLight} />}
              />
            )}

            <Input
              label="Email"
              placeholder="vivekmahajan045@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={18} color={colors.textLight} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textLight} />}
            />

            <Button
              title={authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
              onPress={handleAuthAction}
              loading={authLoading}
              fullWidth
              style={{ marginTop: 10 }}
            />

            <View style={styles.modalToggleRow}>
              <Text style={{ color: colors.textSecondary }}>
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity
                onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {authMode === 'login' ? 'Register' : 'Login'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Law Dictionary Modal */}
      <Modal
        visible={isDictionaryOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDictionaryOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Law Dictionary</Text>
              <TouchableOpacity onPress={() => { setIsDictionaryOpen(false); setDictQuery(''); setDictResult(null); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter legal term (e.g. bail, cognizable)..."
              placeholderTextColor={colors.textLight}
              value={dictQuery}
              onChangeText={setDictQuery}
              style={[styles.dictInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            />

            <Button
              title="Look Up"
              onPress={handleSearchDictionary}
              fullWidth
              style={{ marginVertical: 10 }}
            />

            {dictResult && (
              <View style={[styles.dictResultBox, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.dictResultText, { color: colors.text }]}>{dictResult}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  menuIconButton: {
    padding: Spacing.xs,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoTextMain: {
    fontSize: 20,
    fontWeight: '800',
  },
  logoTextSub: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF8A4D', // Saffron accent
  },
  logoLawIndia: {
    fontSize: FontSize.xs,
    marginLeft: 6,
    fontWeight: '500',
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF8A4D', // Matches saffron underline
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },

  // 2x2 Core Cards Grid
  coreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  coreCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md - 4) / 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  coreCardHeader: {
    marginBottom: Spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: 2,
  },
  coreCardSub: {
    fontSize: FontSize.xs,
  },

  // Daily Banner
  dailyBanner: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  bannerBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTextCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  bannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: FontSize.xs,
  },
  bannerReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFBF00',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  bannerReadButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#000000',
  },

  // AI Tools Section
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiToolsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  aiToolCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aiToolLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },

  // Utilities Grid
  utilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  utilityCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md - 4) / 2,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  utilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  utilityLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Floating Dictionary Icon
  floatingDictionaryIcon: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5C93FC',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  redDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Drawer styles
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 9999,
  },
  drawerContainer: {
    width: 300,
    height: '100%',
    paddingTop: Spacing.xxl,
  },
  drawerHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  drawerAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  drawerHeaderInfo: {
    flex: 1,
  },
  drawerName: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  drawerEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  proCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: 6,
  },
  proCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  proTextTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  membershipButton: {
    backgroundColor: '#5C93FC',
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  membershipButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  drawerScroll: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  drawerSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  drawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerItemText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
    zIndex: 99999,
  },
  modalCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  modalToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  dictInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: FontSize.sm,
  },
  dictResultBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  dictResultText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Advocate List styles
  advocatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  advocateTitleText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  advocatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  advocateCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md - 4) / 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  advocateProfileWrapper: {
    marginBottom: Spacing.sm,
  },
  advocatePhotoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoText: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 1,
  },
  advocateName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  advocateSpecialization: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 2,
  },
  advocateExp: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 6,
  },
  advocateLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  advocateLocationText: {
    fontSize: 10,
  },
  contactNowButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  contactNowButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  advocateFloatingButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  expertsButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  expertsButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.xs,
  },
  dictionaryFloatButton: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: BorderRadius.md,
  },

  // Sub-screens common styles
  subScreenContainer: {
    flex: 1,
  },
  subScreenHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    padding: Spacing.xs,
  },
  subScreenTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  subScreenScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl * 2,
  },
  comparisonCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  comparisonCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  comparisonBadgeNew: {
    flex: 1,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  badgeBigText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  vsText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  comparisonBadgeOld: {
    flex: 1,
    height: 72,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMiniTextOld: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeBigTextOld: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginTop: 2,
  },

  // Court Registry styles
  searchBarContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  registrySearchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },
  courtItemCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  courtItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  courtIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  courtItemText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  floatingSearchJudgments: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5C93FC',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: 8,
    ...Shadow.md,
  },
  floatingSearchJudgmentsText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.sm,
  },

  // Quick Reference sub-screen styles
  quickRefTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  quickRefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickRefButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
  },
  quickRefText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  repealedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
});
