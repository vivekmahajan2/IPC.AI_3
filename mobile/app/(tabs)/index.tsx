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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useTheme } from '../../context/ThemeContext';
import api from '../../lib/api';
import { storage } from '../../lib/auth';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import { FIRDraft } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Which Section of the Bharatiya Nyaya Sanhita (BNS), 2023 replaces Section 302 IPC for Punishment for Murder?',
    options: ['Section 101', 'Section 103(1)', 'Section 109', 'Section 115'],
    correctIndex: 1,
    explanation: 'Section 103(1) of BNS, 2023 defines and punishes murder (death or life imprisonment and fine), replacing Section 302 of the Indian Penal Code, 1860.',
  },
  {
    id: 2,
    question: 'Under Section 105 of BNSS, 2023, what procedural safeguard is now mandatory during search and seizure?',
    options: [
      'Written clearance from District Magistrate',
      'Audio-video electronic recording of the entire process',
      'Mandatory presence of three advocates',
      'Live transmission to national media portal',
    ],
    correctIndex: 1,
    explanation: 'Section 105 of BNSS, 2023 mandates audio-video electronic recording of search of a place or seizure of any property, preferably via mobile phone, to be submitted to the Magistrate without delay.',
  },
  {
    id: 3,
    question: 'What reformative punishment has been introduced in BNS for first-time petty theft under ₹5,000 (Section 303(2))?',
    options: [
      'Mandatory solitary confinement for 6 months',
      'Community Service upon restitution',
      'Suspension of passport and driving license',
      'Public apology in local newspapers',
    ],
    correctIndex: 1,
    explanation: 'Section 303(2) proviso of BNS introduces Community Service as a reformative sentence for first-time offenders where the stolen property value is less than ₹5,000 upon return or restitution.',
  },
  {
    id: 4,
    question: 'Under Bharatiya Sakshya Adhiniyam (BSA), 2023, how are electronic and digital records treated in evidence?',
    options: [
      'Inadmissible unless supported by handwritten affidavit',
      'Primary evidence with the same legal effect and validity as paper documents',
      'Only admissible as secondary hearsay',
      'Requires prior sanction of the President of India',
    ],
    correctIndex: 1,
    explanation: 'Section 61 of BSA, 2023 explicitly provides that electronic or digital records have the same legal standing, effect, and admissibility as conventional paper documents.',
  },
  {
    id: 5,
    question: 'Under Section 33 & Schedule of Digital Personal Data Protection (DPDP) Act, 2023, what is the maximum penalty for failure to prevent personal data breach?',
    options: ['Up to ₹10 Crore', 'Up to ₹50 Crore', 'Up to ₹250 Crore', 'Up to ₹500 Crore'],
    correctIndex: 2,
    explanation: 'Section 33 and the Schedule of the DPDP Act, 2023 prescribe statutory penalties up to ₹250 Crore for failure to take reasonable security safeguards to prevent personal data breaches.',
  },
];

const QUICK_PROMPTS_BY_MODE = {
  advice: [
    { title: '🛡️ Arrest Rights BNSS 35', prompt: 'What are the statutory rights and procedural safeguards for an accused during arrest under Section 35 of BNSS, 2023?' },
    { title: '💳 Cheque Bounce NI 138', prompt: 'What is the exact step-by-step procedure and notice timeline for cheque bounce under Section 138 of Negotiable Instruments Act?' },
    { title: '⚖️ Anticipatory Bail', prompt: 'What are the legal conditions and grounds for grant of anticipatory bail under BNSS Section 482?' },
    { title: '🌐 Cyber Fraud & UPI', prompt: 'What legal steps and remedies exist under BNS and IT Act for an unauthorized UPI bank transfer fraud?' },
  ],
  strategy: [
    { title: '🚗 Vehicle Theft & Fake Plate', prompt: 'Accused intercepted with a stolen motor vehicle having a forged number plate and altered chassis number. What sections apply under BNS and Motor Vehicles Act?' },
    { title: '💼 Commercial Contract Breach', prompt: 'Supplier delivered substandard materials and withheld refund despite formal dispute notice. Evaluate civil recovery vs criminal breach of trust under BNS.' },
    { title: '🏡 Land Encroachment', prompt: 'Complainant alleges unauthorized construction on ancestral agricultural land accompanied by verbal threats. Analyze criminal trespass and intimidation provisions.' },
    { title: '🏥 Medical Negligence', prompt: 'Patient suffered severe complications following an unconsented surgical procedure. Evaluate criminal negligence under BNS 106 vs consumer tort liability.' },
  ],
  judgment: [
    { title: '🏛️ Lalita Kumari (Mandatory FIR)', prompt: 'Lalita Kumari v. Government of U.P. on mandatory registration of FIR under Section 154 CrPC' },
    { title: '🛡️ D.K. Basu (Arrest Guidelines)', prompt: 'D.K. Basu v. State of West Bengal guidelines for arrest, custody and interrogation' },
    { title: '⚖️ Arnesh Kumar (41A Notice)', prompt: 'Arnesh Kumar v. State of Bihar guidelines on arrests for offences punishable with imprisonment up to 7 years' },
    { title: '🩸 Bachan Singh (Death Penalty)', prompt: 'Bachan Singh v. State of Punjab rarest of rare doctrine for capital punishment' },
  ]
};

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

  // AI Suite Workspace states
  const [aiTitle, setAiTitle] = useState('Legal AI Suite');
  const [aiSubtitle, setAiSubtitle] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiWorkspaceMode, setAiWorkspaceMode] = useState<'advice' | 'strategy' | 'judgment'>('advice');
  const [aiWorkspaceQuery, setAiWorkspaceQuery] = useState('');
  const [aiWorkspaceLoading, setAiWorkspaceLoading] = useState(false);
  const [aiWorkspaceResult, setAiWorkspaceResult] = useState<{
    answer: string;
    sources?: any[];
    suggestedSections?: string[];
    details?: any[];
    judgments?: any[];
  } | null>(null);
  const [aiWorkspaceError, setAiWorkspaceError] = useState<string | null>(null);

  // Daily Poll state
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [userPollVote, setUserPollVote] = useState<number | null>(null);
  const [pollSelectedOption, setPollSelectedOption] = useState<number | null>(null);
  const [pollVoteCounts, setPollVoteCounts] = useState<number[]>([824, 372, 145, 87]);

  // Quiz Modal state
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizIsAnswered, setQuizIsAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // UI interaction states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  interface LegalDictItem {
    id: number;
    term: string;
    definition: string;
    simple_explanation: string;
    related_provisions: string[];
    examples?: string;
    category: string;
  }

  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictQuery, setDictQuery] = useState('');
  const [dictItems, setDictItems] = useState<LegalDictItem[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<LegalDictItem | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [dictCategory, setDictCategory] = useState('All');

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
    // Retrieve stored daily poll vote if available
    storage.getItem('@daily_poll_vote_2026').then((val) => {
      if (val !== null) {
        setUserPollVote(parseInt(val, 10));
      }
    }).catch(console.warn);
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

  // AI Suite Workspace submit handler
  const handleAIWorkspaceSubmit = async (customQuery?: string) => {
    const q = (customQuery || aiWorkspaceQuery).trim();
    if (!q || aiWorkspaceLoading) return;
    if (customQuery) setAiWorkspaceQuery(customQuery);

    setAiWorkspaceLoading(true);
    setAiWorkspaceError(null);
    setAiWorkspaceResult(null);

    try {
      if (aiWorkspaceMode === 'advice') {
        const res = await api.post('/legal/query', { query: q, context: 'legal_advice' });
        setAiWorkspaceResult({
          answer: res.data.answer,
          sources: res.data.sources || [],
        });
      } else if (aiWorkspaceMode === 'strategy') {
        const [suggestRes, queryRes] = await Promise.allSettled([
          api.post('/legal/suggest-sections', { description: q, title: 'Case Analysis' }),
          api.post('/legal/query', {
            query: `Analyze these case facts and provide comprehensive legal strategy, applicable offences under BNS/BNSS/IPC, defense strategy, and procedural next steps for: ${q}`,
            context: 'case_strategy'
          }),
        ]);

        let suggestedSections: string[] = [];
        let details: any[] = [];
        if (suggestRes.status === 'fulfilled' && suggestRes.value && (suggestRes.value as any).data) {
          suggestedSections = (suggestRes.value as any).data.suggested_sections || [];
          details = (suggestRes.value as any).data.details || [];
        }

        let answer = '';
        let sources: any[] = [];
        if (queryRes.status === 'fulfilled' && queryRes.value && (queryRes.value as any).data) {
          answer = (queryRes.value as any).data.answer || '';
          sources = (queryRes.value as any).data.sources || [];
        } else if (details.length > 0) {
          answer = `### Recommended Applicable Sections\n\n` +
            details.map((d: any) => `**${d.section}** (${d.title})\n${d.reason}`).join('\n\n');
        }

        setAiWorkspaceResult({
          answer: answer || 'Analysis completed. Review suggested sections above.',
          sources,
          suggestedSections,
          details,
        });
      } else if (aiWorkspaceMode === 'judgment') {
        let dbJudgments: any[] = [];
        try {
          const jRes = await api.get('/judgments/search', { params: { q: q, limit: 10 } });
          dbJudgments = jRes.data || [];
        } catch (e) {
          console.warn('DB Judgment search failed:', e);
        }

        const queryRes = await api.post('/legal/query', {
          query: `Provide landmark Indian judicial precedents, Supreme Court rulings, and case citations for: ${q}`,
          context: 'judgment_precedents'
        });

        setAiWorkspaceResult({
          answer: queryRes.data.answer,
          sources: queryRes.data.sources || [],
          judgments: dbJudgments,
        });
      }
    } catch (err: any) {
      console.error('AI Workspace error:', err);
      setAiWorkspaceError(
        err.response?.data?.detail ||
        'Unable to complete legal analysis. Please verify your network connection and try again.'
      );
    } finally {
      setAiWorkspaceLoading(false);
    }
  };

  const handleShareAIResult = async () => {
    if (!aiWorkspaceResult?.answer) return;
    try {
      await Share.share({
        title: 'IPC.AI Legal Analysis',
        message: `${aiWorkspaceResult.answer}\n\nGenerated by IPC.AI - Legal Intelligence Platform`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleVotePoll = async (index: number) => {
    setUserPollVote(index);
    setPollVoteCounts((prev) => prev.map((cnt, i) => (i === index ? cnt + 1 : cnt)));
    try {
      await storage.setItem('@daily_poll_vote_2026', String(index));
    } catch (e) {
      console.warn('Failed to persist poll vote:', e);
    }
  };

  const handleSelectQuizOption = (optionIndex: number) => {
    if (quizIsAnswered) return;
    setQuizSelectedOption(optionIndex);
    setQuizIsAnswered(true);
    if (optionIndex === QUIZ_QUESTIONS[quizIndex].correctIndex) {
      setQuizScore((s) => s + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    if (quizIndex < QUIZ_QUESTIONS.length - 1) {
      setQuizIndex((prev) => prev + 1);
      setQuizSelectedOption(null);
      setQuizIsAnswered(false);
    } else {
      setQuizFinished(true);
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizSelectedOption(null);
    setQuizIsAnswered(false);
    setQuizScore(0);
    setQuizFinished(false);
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

  const fetchDictionaryTerms = async (query = '', category = 'All') => {
    setIsDictLoading(true);
    try {
      const params: any = {};
      if (query.trim()) params.q = query.trim();
      if (category !== 'All') params.category = category;
      const res = await api.get('/dictionary', { params });
      const data: LegalDictItem[] = res.data || [];
      setDictItems(data);
      if (data.length > 0) {
        setSelectedTerm(data[0]);
      } else {
        setSelectedTerm(null);
      }
    } catch (err) {
      console.log('Error fetching dictionary:', err);
    } finally {
      setIsDictLoading(false);
    }
  };

  useEffect(() => {
    if (isDictionaryOpen) {
      fetchDictionaryTerms(dictQuery, dictCategory);
    }
  }, [isDictionaryOpen, dictCategory]);

  const handleSearchDictionary = () => {
    fetchDictionaryTerms(dictQuery, dictCategory);
  };

  const handleContactLawyer = (lawyerName: string) => {
    Alert.alert('Contacting Advocate', `Initiating contact request with ${lawyerName}...`);
  };

  // Render Sub-Screen: Act Comparison
  const renderActComparison = () => {
    const comparisonBlocks = [
      {
        id: 'bns_ipc',
        title: 'BNS v/s IPC',
        subtitle: 'Substantive Criminal Penal Code',
        newAct: 'BNS',
        newLabel: 'Bharatiya Nyaya Sanhita, 2023',
        newSecCount: '358 Secs',
        newColor: '#7C3AED',
        oldAct: 'IPC',
        oldLabel: 'Indian Penal Code, 1860',
        oldSecCount: '511 Secs',
        oldColor: '#7C3AED',
        highlight: 'Community service added, sedition repealed, organized crime & mob lynching codified.',
      },
      {
        id: 'bnss_crpc',
        title: 'BNSS v/s CrPC',
        subtitle: 'Procedural Criminal Justice & Investigation',
        newAct: 'BNSS',
        newLabel: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
        newSecCount: '531 Secs',
        newColor: '#059669',
        oldAct: 'CrPC',
        oldLabel: 'Code of Criminal Procedure, 1973',
        oldSecCount: '484 Secs',
        oldColor: '#059669',
        highlight: 'Mandatory videography in search/seizure, forensic visit for 7+ yr crimes, Zero FIR statutory backing.',
      },
      {
        id: 'bsa_iea',
        title: 'BSA v/s IEA',
        subtitle: 'Law of Evidence & Digital Admissibility',
        newAct: 'BSA',
        newLabel: 'Bharatiya Sakshya Adhiniyam, 2023',
        newSecCount: '170 Secs',
        newColor: '#D97706',
        oldAct: 'IEA',
        oldLabel: 'Indian Evidence Act, 1872',
        oldSecCount: '167 Secs',
        oldColor: '#D97706',
        highlight: 'Electronic and digital records given primary evidence standing, modernized forensic proof standards.',
      },
    ];

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
          {comparisonBlocks.map((block) => (
            <Card key={block.id} style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.comparisonHeader}>
                <Text style={[styles.comparisonCardTitle, { color: colors.text }]}>{block.title}</Text>
                <Text style={[styles.comparisonSubtitle, { color: colors.textSecondary }]}>{block.subtitle}</Text>
              </View>

              <View style={styles.comparisonRow}>
                {/* NEW LAW BADGE */}
                <TouchableOpacity
                  style={[styles.comparisonBadgeNew, { backgroundColor: block.newColor }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setScreenState('dashboard');
                    router.push(`/bare-act?act=${block.newAct}`);
                  }}
                >
                  <Text style={styles.badgeMiniText}>NEW</Text>
                  <Text style={styles.badgeBigText}>{block.newAct}</Text>
                  <Text style={styles.badgeSubText}>{block.newSecCount}</Text>
                </TouchableOpacity>

                {/* MIDDLE INTERACTIVE CONVERTER BUTTON (Tapping middle opens converter) */}
                <TouchableOpacity
                  style={[styles.comparisonMiddleButton, { backgroundColor: colors.surface, borderColor: block.newColor }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setScreenState('dashboard');
                    router.push({
                      pathname: '/(tabs)/converter',
                      params: { act: block.oldAct.toUpperCase(), direction: 'old_to_new' },
                    });
                  }}
                >
                  <View style={[styles.comparisonMiddleCircle, { backgroundColor: block.newColor }]}>
                    <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.comparisonMiddleText, { color: colors.text }]}>vs</Text>
                  <Text style={[styles.comparisonMiddleSubText, { color: block.newColor }]}>Convert ⇄</Text>
                </TouchableOpacity>

                {/* OLD LAW BADGE */}
                <TouchableOpacity
                  style={[styles.comparisonBadgeOld, { borderColor: block.oldColor }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setScreenState('dashboard');
                    router.push(`/bare-act?act=${block.oldAct}`);
                  }}
                >
                  <Text style={[styles.badgeMiniTextOld, { color: block.oldColor }]}>OLD</Text>
                  <Text style={[styles.badgeBigTextOld, { color: block.oldColor }]}>{block.oldAct}</Text>
                  <Text style={[styles.badgeSubTextOld, { color: colors.textSecondary }]}>{block.oldSecCount}</Text>
                </TouchableOpacity>
              </View>

              {/* Key Legislative Shift Highlight */}
              <View style={[styles.comparisonHighlightBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="flash-outline" size={14} color={block.newColor} />
                <Text style={[styles.comparisonHighlightText, { color: colors.textSecondary }]}>
                  {block.highlight}
                </Text>
              </View>

              {/* Direct Open in Sanhita Converter Bar */}
              <TouchableOpacity
                style={[styles.openConverterBar, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                activeOpacity={0.7}
                onPress={() => {
                  setScreenState('dashboard');
                  router.push({
                    pathname: '/(tabs)/converter',
                    params: { act: block.oldAct.toUpperCase(), direction: 'old_to_new' },
                  });
                }}
              >
                <Ionicons name="git-compare-outline" size={16} color={colors.primary} />
                <Text style={[styles.openConverterBarText, { color: colors.primary }]}>
                  Open {block.newAct} ↔ {block.oldAct} Sanhita Converter
                </Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </Card>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render Sub-Screen: Court Registry
  const renderCourtRegistry = () => {
    const courtRegistryData = [
      {
        name: 'Supreme Court of India',
        category: 'Apex Court',
        principalSeat: 'Tilak Marg, New Delhi',
        benches: 'Constitution Benches & Special Benches',
        jurisdiction: 'Entire Territory of India (Articles 32, 131-136, 141, 142)',
        established: '28 January 1950',
        services: ['e-Filing 3.0', 'Daily Orders', 'Caveat Search', 'Live Streaming', 'Cause Lists'],
        description: 'The highest judicial forum and final court of appeal under the Constitution of India. Decisions of the Supreme Court are binding law of the land across all courts within India under Article 141.',
        registryDetails: 'Registrar General oversees Judicial, Listing, Caveat, and Digitization registries. Operates 24/7 digital e-filing portal and paperless hearing facilities.',
      },
      {
        name: 'Supreme Court - Daily Orders & Listing',
        category: 'Daily Orders / Benches',
        principalSeat: 'New Delhi',
        benches: 'All Courtrooms & Registrar Courts',
        jurisdiction: 'Daily Orders, Mentioning Slips, Tentative Cause Lists',
        established: 'Real-time Digital Registry',
        services: ['Daily Signed Orders', 'Office Reports', 'Mentioning Portal', 'Neutral Citations'],
        description: 'Official digital repository providing contemporaneous signed orders, record of proceedings, and cause list announcements for all benches of the Supreme Court.',
        registryDetails: 'Instantaneous order upload within hours of pronouncement, integrated with National Judicial Data Grid (NJDG).',
      },
      {
        name: 'Bombay High Court',
        category: 'Chartered High Court',
        principalSeat: 'Mumbai, Maharashtra',
        benches: 'Nagpur, Aurangabad & Panaji (Goa)',
        jurisdiction: 'Maharashtra, Goa, Dadra & Nagar Haveli and Daman & Diu',
        established: '14 August 1862',
        services: ['Online Case Status', 'CIS Certified Copies', 'e-Pass Registry', 'Cause Lists'],
        description: 'Chartered High Court exercising extraordinary original civil and criminal jurisdiction, appellate, and supervisory writ powers under Articles 226 and 227.',
        registryDetails: 'Registrar General at Principal Bench Mumbai with Additional Registrars at Nagpur, Aurangabad, and Goa benches.',
      },
      {
        name: 'Delhi High Court',
        category: 'High Court',
        principalSeat: 'Sher Shah Road, New Delhi',
        benches: 'Principal Bench',
        jurisdiction: 'National Capital Territory of Delhi',
        established: '31 October 1966',
        services: ['Paperless Digital Courts', 'Online e-Filing', 'Virtual Hearings', 'e-RTI Portal'],
        description: 'Leading technologically modernized High Court exercising original civil jurisdiction and comprehensive constitutional writ powers across Delhi NCR.',
        registryDetails: 'Full-fledged digital registry handling commercial division filings, PILs, and criminal appeals with 100% digital workflows.',
      },
      {
        name: 'Allahabad High Court',
        category: 'High Court',
        principalSeat: 'Prayagraj (Allahabad), Uttar Pradesh',
        benches: 'Lucknow Bench',
        jurisdiction: 'State of Uttar Pradesh',
        established: '1866 (Relocated to Allahabad 1869)',
        services: ['Web Copy Certification', 'Case Information System', 'Cause List Archive', 'e-Gate Pass'],
        description: 'The largest High Court in India by judicial sanctioned strength, exercising vital criminal appellate, bail jurisdiction, and constitutional oversight.',
        registryDetails: 'Handles massive volume of criminal and civil filings with dedicated digital reporting desks at Prayagraj and Lucknow.',
      },
      {
        name: 'Madras High Court',
        category: 'Chartered High Court',
        principalSeat: 'Chennai, Tamil Nadu',
        benches: 'Madurai Bench',
        jurisdiction: 'State of Tamil Nadu & Union Territory of Puducherry',
        established: '26 June 1862',
        services: ['e-Filing Portal', 'Neutral Citation Search', 'Digital Certified Copies', 'Legal Aid'],
        description: 'Historic chartered High Court with extensive maritime, admiralty, original, and appellate jurisdiction over Tamil Nadu and Puducherry.',
        registryDetails: 'Principal Registry at Chennai overseeing judicial records, scrutiny benches, and Madurai circuit administration.',
      },
      {
        name: 'Calcutta High Court',
        category: 'Chartered High Court',
        principalSeat: 'Kolkata, West Bengal',
        benches: 'Jalpaiguri Circuit Bench & Port Blair (Andaman & Nicobar)',
        jurisdiction: 'State of West Bengal & Union Territory of Andaman and Nicobar Islands',
        established: '1 July 1862 (Oldest in India)',
        services: ['Neutral Citation', 'Online Copying', 'Digital Case Docket', 'Cause List Portal'],
        description: 'The oldest High Court in India, established by Letters Patent under the High Courts Act 1861, with original civil, criminal, and island jurisdiction.',
        registryDetails: 'Maintains ancient judicial records and modern e-Courts case information systems for mainland and Island circuits.',
      },
      {
        name: 'Karnataka High Court',
        category: 'High Court',
        principalSeat: 'Bengaluru, Karnataka (Attara Kacheri)',
        benches: 'Dharwad Bench & Kalaburagi Bench',
        jurisdiction: 'State of Karnataka',
        established: '1884',
        services: ['Digital Courtrooms', 'Online Case Status', 'Cause List System', 'e-Filing Portal'],
        description: 'Pioneering judicial institution housed in the historic Attara Kacheri, renowned for progressive commercial division, IT, and constitutional jurisprudence.',
        registryDetails: 'Advanced IT-enabled registry supporting paperless commercial benches and video-conferencing connectivity.',
      },
      {
        name: 'Gujarat High Court',
        category: 'High Court',
        principalSeat: 'Sola, Ahmedabad, Gujarat',
        benches: 'Principal Bench',
        jurisdiction: 'State of Gujarat',
        established: '1 May 1960',
        services: ['Live Streaming Portal', 'Digital e-Courts', 'Cause List Search', 'Certified Copies'],
        description: 'First High Court in India to introduce mandatory open live streaming of judicial proceedings, exercising appellate and writ powers.',
        registryDetails: 'High-tech judicial registry managing automated case numbering, digital scrutiny, and e-summons issuance.',
      },
      {
        name: 'Gauhati High Court',
        category: 'High Court',
        principalSeat: 'Guwahati, Assam',
        benches: 'Kohima (Nagaland), Aizawl (Mizoram) & Itanagar (Arunachal Pradesh)',
        jurisdiction: 'Assam, Nagaland, Mizoram & Arunachal Pradesh',
        established: '1 March 1948',
        services: ['North-East e-Registry', 'Case Tracking', 'Digital Cause Lists', 'Legal Services'],
        description: 'Unique multi-state High Court administering justice across four North Eastern States, safeguarding diverse tribal customs and constitutional protections.',
        registryDetails: 'Operates central registry at Guwahati with permanent registries in Nagaland, Mizoram, and Arunachal Pradesh.',
      },
      {
        name: 'Andhra Pradesh High Court',
        category: 'High Court',
        principalSeat: 'Nelapadu, Amaravati, Andhra Pradesh',
        benches: 'Principal Bench',
        jurisdiction: 'State of Andhra Pradesh',
        established: '1 January 2019',
        services: ['e-Courts Services', 'Daily Cause List', 'Caveat Search', 'Case Tracking'],
        description: 'Modern high-tech High Court established post-bifurcation, exercising constitutional jurisdiction over the State of Andhra Pradesh.',
        registryDetails: 'Fully digital case management system enabling real-time notifications to advocates and litigants.',
      },
      {
        name: 'Chhattisgarh High Court',
        category: 'High Court',
        principalSeat: 'Bodri, Bilaspur, Chhattisgarh',
        benches: 'Principal Bench',
        jurisdiction: 'State of Chhattisgarh',
        established: '1 November 2000',
        services: ['e-Filing', 'Case Status', 'CIS Cause List', 'Digital Certified Copies'],
        description: 'High Court located at Bilaspur, exercising jurisdiction over 33 districts of Chhattisgarh with specialized tribal rights and environmental benches.',
        registryDetails: 'Centralized registry handling bail applications, criminal revisions, and constitutional writ matters.',
      },
    ];

    const filteredCourts = courtRegistryData.filter((court) =>
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.principalSeat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.jurisdiction.toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder="Search Registry by court, seat, or jurisdiction..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.registrySearchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.subScreenScrollContent}>
          {filteredCourts.map((court, index) => (
            <Card
              key={index}
              style={[styles.courtCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Top Row: Name and Type Badge */}
              <View style={styles.courtCardTop}>
                <View style={styles.courtCardTitleRow}>
                  <View style={[styles.courtIconContainer, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="business" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.courtItemText, { color: colors.text, fontSize: FontSize.md }]}>
                      {court.name}
                    </Text>
                    <Text style={[styles.courtMetaText, { color: colors.textSecondary }]}>
                      Est. {court.established} · {court.category}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Seat & Benches */}
              <View style={styles.courtMetaRow}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={[styles.courtMetaText, { color: colors.text, fontWeight: '600' }]}>
                  {court.principalSeat}
                </Text>
              </View>
              {court.benches && (
                <View style={[styles.courtMetaRow, { marginTop: 2 }]}>
                  <Ionicons name="git-branch-outline" size={14} color={colors.textLight} />
                  <Text style={[styles.courtMetaText, { color: colors.textSecondary }]}>
                    {court.benches}
                  </Text>
                </View>
              )}

              {/* Jurisdiction */}
              <View style={[styles.courtMetaRow, { marginTop: 4 }]}>
                <Ionicons name="shield-outline" size={14} color={colors.secondary} />
                <Text style={[styles.courtMetaText, { color: colors.textSecondary, flex: 1 }]}>
                  {court.jurisdiction}
                </Text>
              </View>

              {/* Description Overview */}
              <Text style={[styles.courtOverviewText, { color: colors.textSecondary }]}>
                {court.description}
              </Text>

              {/* Registry Services Chips */}
              <View style={styles.courtServicesRow}>
                {court.services.map((service, sIdx) => (
                  <View
                    key={sIdx}
                    style={[styles.courtServiceChip, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={[styles.courtServiceChipText, { color: colors.primary }]}>
                      {service}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Card Actions */}
              <View style={[styles.courtActionsRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.courtActionButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setAiTitle(`${court.name} — Registry Details`);
                    setAiSubtitle(`Seat: ${court.principalSeat} · Est. ${court.established}`);
                    setAiDescription(
                      `COURT REGISTRY DOSSIER — ${court.name.toUpperCase()}\n\n` +
                      `Category: ${court.category}\n` +
                      `Principal Seat: ${court.principalSeat}\n` +
                      `${court.benches ? `Permanent / Circuit Benches: ${court.benches}\n` : ''}` +
                      `Territorial & Constitutional Jurisdiction: ${court.jurisdiction}\n` +
                      `Established: ${court.established}\n\n` +
                      `KEY REGISTRY SERVICES:\n${court.services.map((s) => `• ${s}`).join('\n')}\n\n` +
                      `COURT OVERVIEW:\n${court.description}\n\n` +
                      `REGISTRY & FILING INSTRUCTIONS:\n${court.registryDetails}`
                    );
                    setScreenState('ai-helper');
                  }}
                >
                  <Ionicons name="information-circle-outline" size={15} color={colors.secondary} />
                  <Text style={[styles.courtActionText, { color: colors.secondary }]}>Registry Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.courtActionButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setScreenState('dashboard');
                    router.push('/judgments');
                  }}
                >
                  <Ionicons name="search" size={15} color={colors.primary} />
                  <Text style={[styles.courtActionText, { color: colors.primary }]}>Search Judgments</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
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
          <Text style={styles.floatingSearchJudgmentsText}>Search All Judgments</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Sub-Screen: COI (Constitution of India)
  const renderCOI = () => {
    const coiParts = [
      {
        part: 'Preamble',
        title: 'Preamble to the Constitution',
        range: 'Preamble',
        summary: 'The guiding soul and philosophy of the Constitution declaring India to be a Sovereign, Socialist, Secular, Democratic Republic committed to Justice, Liberty, Equality, and Fraternity.',
        keyArticles: ['Solemn Declaration of the Sovereign Republic', '42nd Amendment Inclusions (Secular, Socialist, Integrity)', 'Basic Structure Doctrine Anchor'],
        doctrines: 'Basic Structure Doctrine, Sovereign Republic, Constitutional Supremacy',
        details: 'The Preamble embodies the fundamental objectives of the Indian State. In Kesavananda Bharati (1973), the Supreme Court ruled that the Preamble is an integral part of the Constitution and forms the foundational basis of the Basic Structure Doctrine, precluding Parliament from altering its essential democratic and secular character.',
      },
      {
        part: 'Part I',
        title: 'The Union and its Territory',
        range: 'Articles 1-4',
        summary: 'Defines India as an indestructible Union of destructible States, governing the admission, establishment, and territorial re-organization of States and Union Territories.',
        keyArticles: ['Art 1: India, that is Bharat, shall be a Union of States', 'Art 2: Admission or establishment of new States', 'Art 3: Formation of new States & alteration of boundaries'],
        doctrines: 'Federal Indestructible Union, Territorial Integrity',
        details: 'Part I vests plenary power in Parliament to reorganize state boundaries by simple majority legislation under Article 3. Under Article 1, India is declared a Union of States rather than a Federation, emphasizing national unity over state succession.',
      },
      {
        part: 'Part II',
        title: 'Citizenship',
        range: 'Articles 5-11',
        summary: 'Regulates constitutional citizenship at the commencement of the Republic and vests plenary authority in Parliament to govern acquisition, termination, and overseas citizenship rights.',
        keyArticles: ['Art 5: Citizenship at the commencement', 'Art 9: Persons acquiring foreign citizenship lose Indian citizenship', 'Art 11: Parliament to regulate rights of citizenship by law'],
        doctrines: 'Single Citizenship, Parliamentary Supremacy in Nationality',
        details: 'India maintains a unified single citizenship throughout the nation. Under Article 11, Parliament enacted the Citizenship Act, 1955, regulating birth, descent, registration, naturalization, and overseas citizenship.',
      },
      {
        part: 'Part III',
        title: 'Fundamental Rights',
        range: 'Articles 12-35',
        summary: 'The Magna Carta of India guaranteeing justiciable civil liberties against state encroachment, covering equality, core freedoms, personal liberty, and constitutional writ remedies.',
        keyArticles: ['Art 14: Equality before law & equal protection', 'Art 19: Protection of 6 core freedoms', 'Art 21: Right to life & personal liberty', 'Art 22: Arrest & detention safeguards', 'Art 32: Constitutional remedies (Writs)'],
        doctrines: 'Due Process of Law, Non-Arbitrariness, Golden Triangle (Arts 14, 19, 21), Basic Structure',
        details: 'Part III forms the bedrock of Indian constitutional jurisprudence. Article 21 has been expanded by the Supreme Court (Maneka Gandhi, Puttaswamy) to encompass the right to privacy, speedy trial, dignity, and free legal aid. Article 32 empowers citizens to directly approach the Supreme Court via Habeas Corpus, Mandamus, Prohibition, Quo Warranto, and Certiorari.',
      },
      {
        part: 'Part IV',
        title: 'Directive Principles of State Policy',
        range: 'Articles 36-51',
        summary: 'Fundamental non-justiciable principles obligating the State to establish a socio-economic welfare state, reduce inequalities, provide free legal aid, and promote international peace.',
        keyArticles: ['Art 39A: Equal justice and free legal aid', 'Art 40: Organization of village panchayats', 'Art 44: Uniform Civil Code for citizens', 'Art 50: Separation of judiciary from executive'],
        doctrines: 'Welfare State, Harmonious Construction with Fundamental Rights (Minerva Mills)',
        details: 'Though unenforceable by court mandamus under Article 37, DPSP are fundamental in national governance. In Minerva Mills (1980), the Supreme Court held that the Constitution rests on the harmonious balance between Part III and Part IV.',
      },
      {
        part: 'Part IVA',
        title: 'Fundamental Duties',
        range: 'Article 51A',
        summary: 'Prescribes eleven moral and civic obligations for every Indian citizen, including honoring the Constitution, preserving composite heritage, protecting forests, and educating children.',
        keyArticles: ['Art 51A(a): Respect Constitution, National Flag & Anthem', 'Art 51A(e): Promote harmony & renounce derogatory practices', 'Art 51A(g): Protect wildlife and forests', 'Art 51A(k): Duty to educate children (6-14 yrs)'],
        doctrines: 'Civic Duty & Patriotism, Constitutional Moral Code',
        details: 'Inserted by the 42nd Amendment on the recommendation of the Swaran Singh Committee (with 11th duty added by the 86th Amendment). While not directly enforceable by writs, they serve as authoritative interpretative aids in assessing statutory constitutionality.',
      },
      {
        part: 'Part V',
        title: 'The Union',
        range: 'Articles 52-151',
        summary: 'Establishes the Union Executive (President & Council of Ministers), Parliament (Lok Sabha & Rajya Sabha), and the Supreme Court of India.',
        keyArticles: ['Art 72: Pardoning power of the President', 'Art 124: Establishment & constitution of Supreme Court', 'Art 136: Special Leave Petitions (SLP)', 'Art 141: Law declared by Supreme Court binding on all courts', 'Art 142: Complete justice powers'],
        doctrines: 'Separation of Powers, Judicial Independence, Binding Precedent, Complete Justice',
        details: 'Chapter IV of Part V governs the Union Judiciary. Article 141 establishes the binding nature of Supreme Court precedents on all courts in India, while Article 142 gives the Court plenary authority to issue any decree necessary to do complete justice.',
      },
      {
        part: 'Part VI',
        title: 'The States',
        range: 'Articles 152-237',
        summary: 'Delineates State Executive governance (Governor & Chief Minister), State Legislatures, High Courts, and Subordinate Courts across districts.',
        keyArticles: ['Art 161: Pardoning power of Governor', 'Art 214: High Courts for States', 'Art 226: Extraordinary writ jurisdiction of High Courts', 'Art 227: Power of superintendence over all subordinate courts'],
        doctrines: 'High Court Judicial Review, Supervisory Jurisdiction over Lower Judiciary',
        details: 'Article 226 empowers High Courts to issue prerogative writs not only for Fundamental Rights but for any legal right violation. Article 227 vests High Courts with continuous judicial and administrative superintendence over all lower courts and tribunals.',
      },
      {
        part: 'Part VIII',
        title: 'The Union Territories',
        range: 'Articles 239-242',
        summary: 'Governs the administrative framework for Union Territories administered by the President through Lieutenant Governors, including special provisions for Delhi NCT.',
        keyArticles: ['Art 239: Administration of Union Territories', 'Art 239AA: Special constitutional governance provisions for NCT of Delhi'],
        doctrines: 'Asymmetric Federalism, Direct Union Administration',
        details: 'Article 239AA was inserted by the 69th Amendment establishing an elected Legislative Assembly and Council of Ministers for Delhi, subject to specialized constitutional allocation of police, public order, and land.',
      },
      {
        part: 'Part IX',
        title: 'The Panchayats',
        range: 'Articles 243-243O',
        summary: 'Constitutionalizes decentralized three-tier rural local self-government, Gram Sabhas, reservation for women and SC/ST, and State Finance Commissions.',
        keyArticles: ['Art 243A: Gram Sabha authority', 'Art 243D: Reservation of seats for SC, ST & Women', 'Art 243I: State Finance Commission'],
        doctrines: 'Grassroots Democratic Decentralization, Rural Empowerment',
        details: 'Enacted via the 73rd Amendment, 1992, Part IX transformed rural local bodies into constitutional units of self-government with mandatory five-year elections.',
      },
      {
        part: 'Part IXA',
        title: 'The Municipalities',
        range: 'Articles 243P-243ZG',
        summary: 'Establishes constitutional urban local governance, Nagar Panchayats, Municipal Councils, Municipal Corporations, and Ward Committees.',
        keyArticles: ['Art 243Q: Constitution of Municipalities', 'Art 243T: Reservation of seats in Municipalities', 'Art 243W: Municipal powers and 12th Schedule functions'],
        doctrines: 'Urban Local Self-Government, Metropolitan Planning',
        details: 'Inserted by the 74th Amendment, 1992, creating statutory framework for urban governance, civic revenue allocation, and urban spatial planning.',
      },
      {
        part: 'Part X',
        title: 'The Scheduled and Tribal Areas',
        range: 'Articles 244-244A',
        summary: 'Provides autonomous administrative frameworks under the Fifth and Sixth Schedules to safeguard indigenous tribal cultures, customary laws, and land rights.',
        keyArticles: ['Art 244: Administration of Scheduled and Tribal Areas', 'Fifth Schedule: Tribal Advisory Councils', 'Sixth Schedule: Autonomous District Councils in North-East'],
        doctrines: 'Tribal Autonomy, Customary Law Protection',
        details: 'Grants extensive legislative and judicial autonomy to District Councils in Assam, Meghalaya, Tripura, and Mizoram, shielding tribal populations from land alienation.',
      },
      {
        part: 'Part XI',
        title: 'Relations Between the Union and the States',
        range: 'Articles 245-263',
        summary: 'Regulates legislative, administrative, and interstate relations between Centre and States across the Seventh Schedule (Union, State, Concurrent Lists).',
        keyArticles: ['Art 246: Subject-matter of laws (Seventh Schedule)', 'Art 254: Inconsistency between Central and State laws (Repugnancy)', 'Art 262: Adjudication of interstate water disputes', 'Art 263: Inter-State Council'],
        doctrines: 'Pith and Substance, Doctrine of Repugnancy, Cooperative Federalism',
        details: 'Governs federal supremacy while preserving state legislative competence. In cases of direct conflict in the Concurrent List, Article 254 dictates that Parliamentary law prevails unless the State law received Presidential assent.',
      },
      {
        part: 'Part XII',
        title: 'Finance, Property, Contracts and Suits',
        range: 'Articles 264-300A',
        summary: 'Governs revenue distribution, Consolidated and Contingency Funds, Finance Commission, GST Council, borrowing powers, and the constitutional right to property.',
        keyArticles: ['Art 265: Taxes not to be imposed save by authority of law', 'Art 279A: Goods and Services Tax (GST) Council', 'Art 280: Finance Commission', 'Art 300A: No person deprived of property save by authority of law'],
        doctrines: 'Eminent Domain Limitations, Fiscal Federalism, No Taxation Without Representation',
        details: 'Article 300A guarantees that while property is no longer a Fundamental Right post-44th Amendment, it remains a vital constitutional right requiring explicit statutory authority and public purpose for state acquisition.',
      },
      {
        part: 'Part XIII',
        title: 'Trade, Commerce and Intercourse',
        range: 'Articles 301-307',
        summary: 'Guarantees freedom of trade, commerce, and intercourse throughout the territory of India to prevent internal economic barriers and discriminatory state levies.',
        keyArticles: ['Art 301: Freedom of trade, commerce and intercourse', 'Art 302: Parliamentary power to impose public interest restrictions', 'Art 304: State restrictions on interstate trade'],
        doctrines: 'National Common Market, Economic Unity of India',
        details: 'Modeled after Section 92 of the Australian Constitution, Article 301 safeguards national economic integration while allowing reasonable regulatory measures under Articles 302-304.',
      },
      {
        part: 'Part XIV & XIVA',
        title: 'Services & Tribunals',
        range: 'Articles 308-323B',
        summary: 'Protects civil servants from arbitrary dismissal under Article 311, establishes Union and State Public Service Commissions (UPSC/SPSC), and provides administrative tribunals.',
        keyArticles: ['Art 311: Dismissal, removal or reduction in rank of civil servants', 'Art 315: Public Service Commissions for Union and States', 'Art 323A: Administrative Tribunals (CAT/SAT)'],
        doctrines: 'Doctrine of Pleasure Subject to Safeguards, Specialized Quasi-Judicial Adjudication',
        details: 'Article 311 grants constitutional tenure protections to government servants, requiring formal inquiry and opportunity to be heard before termination. In L. Chandra Kumar (1997), the Supreme Court ruled that tribunal decisions are subject to High Court writ scrutiny under Article 226.',
      },
      {
        part: 'Part XV',
        title: 'Elections',
        range: 'Articles 324-329A',
        summary: 'Vests superintendence, direction, and control of Parliamentary and State elections in the independent Election Commission of India based on universal adult suffrage.',
        keyArticles: ['Art 324: Superintendence of elections in Election Commission', 'Art 325: No exclusion on grounds of religion, race, caste or sex', 'Art 326: Universal Adult Suffrage (Voting at 18 years)'],
        doctrines: 'Free and Fair Elections as Basic Structure, Universal Adult Franchise',
        details: 'Guarantees the democratic foundation of the Republic. The Supreme Court in Indira Nehru Gandhi (1975) declared free and fair elections to be an unalterable component of the Basic Structure.',
      },
      {
        part: 'Part XVI',
        title: 'Special Provisions Relating to Certain Classes',
        range: 'Articles 330-342A',
        summary: 'Establishes constitutional reservations in Parliament and Assemblies, National Commissions for SC, ST, and Backward Classes, and affirmative action frameworks.',
        keyArticles: ['Art 330: Reservation of seats for SC and ST in Lok Sabha', 'Art 338: National Commission for Scheduled Castes', 'Art 338A: National Commission for Scheduled Tribes', 'Art 342A: Socially and educationally backward classes'],
        doctrines: 'Substantive Equality, Affirmative State Action',
        details: 'Provides constitutional representation and institutional oversight to rectify historical marginalization and promote socio-economic equality.',
      },
      {
        part: 'Part XVII',
        title: 'Official Language',
        range: 'Articles 343-351',
        summary: 'Declares Hindi in Devanagari script alongside English for official Union purposes, provides for State languages, judicial language of High Courts/SC, and linguistic minority protections.',
        keyArticles: ['Art 343: Official language of the Union', 'Art 348: Language of Supreme Court, High Courts and Acts/Bills', 'Art 350A: Primary instruction in mother tongue for linguistic minorities'],
        doctrines: 'Linguistic Federalism & Multi-lingual Preservation',
        details: 'Governs official administrative and judicial languages while guaranteeing the protection of linguistic diversity and minority educational rights under Article 350A.',
      },
      {
        part: 'Part XVIII',
        title: 'Emergency Provisions',
        range: 'Articles 352-360',
        summary: 'Empowers the Union to handle existential threats through National Emergency (War/Armed Rebellion), State Breakdown (President\'s Rule), or Financial Emergency.',
        keyArticles: ['Art 352: Proclamation of National Emergency', 'Art 356: Failure of constitutional machinery in States (President Rule)', 'Art 359: Suspension of enforcement of Fundamental Rights (excluding Arts 20 & 21)', 'Art 360: Financial Emergency'],
        doctrines: 'Constitutional Crisis Management, Non-Derogability of Life & Liberty (Arts 20 & 21), S.R. Bommai Safeguards on Art 356',
        details: 'Post-44th Amendment safeguards ensure that the right to life and protection against ex-post facto laws (Articles 20 and 21) can NEVER be suspended during any emergency. In S.R. Bommai (1994), the Supreme Court subjected President\'s Rule under Article 356 to strict judicial review.',
      },
      {
        part: 'Part XIX',
        title: 'Miscellaneous',
        range: 'Articles 361-367',
        summary: 'Provides official immunity to the President and Governors during their tenure, protects publication of parliamentary proceedings, and defines constitutional interpretation rules.',
        keyArticles: ['Art 361: Protection of President and Governors against criminal proceedings', 'Art 361A: Protection of publication of parliamentary proceedings', 'Art 367: Interpretation guidelines'],
        doctrines: 'Executive Head Immunities, Press Freedom in Legislative Reporting',
        details: 'Article 361 immunizes the President and Governors from criminal prosecution while in office. Article 361A (inserted by the 44th Amendment) gives constitutional immunity to newspapers and broadcasters for truthful reporting of legislative proceedings.',
      },
      {
        part: 'Part XX',
        title: 'Amendment of the Constitution',
        range: 'Article 368',
        summary: 'Defines the constituent power and procedures for amending the Constitution by special Parliamentary majority, bounded by the inviolable Basic Structure Doctrine.',
        keyArticles: ['Art 368(1): Constituent power of Parliament to amend the Constitution', 'Art 368(2): Procedure requiring 2/3rd majority & State ratification for federal provisions'],
        doctrines: 'Basic Structure Doctrine (Kesavananda Bharati, Minerva Mills), Constituent vs Legislative Power',
        details: 'Article 368 governs constitutional amendments. In the landmark Kesavananda Bharati (1973) ruling, the Supreme Court held that while Parliament can amend any provision, it has no power to destroy the Basic Structure (democracy, secularism, rule of law, judicial review, federalism).',
      },
      {
        part: 'Part XXI',
        title: 'Temporary, Transitional and Special Provisions',
        range: 'Articles 369-392',
        summary: 'Contains transitional clauses and asymmetric regional protections for Maharashtra, Gujarat, Nagaland, Assam, Manipur, Andhra, Sikkim, Mizoram, Arunachal, and Karnataka.',
        keyArticles: ['Art 371: Special provisions for Maharashtra and Gujarat', 'Art 371A-371J: Regional developmental boards and cultural safeguards in Northeastern & Southern states'],
        doctrines: 'Flexible Transitional Federalism, Regional Developmental Safeguards',
        details: 'Accommodates India\'s rich geographic, cultural, and socio-economic diversity through tailored constitutional mechanisms such as special local rights in Nagaland (371A) and Mizoram (371G).',
      },
      {
        part: 'Part XXII',
        title: 'Short Title, Commencement, Hindi Text & Repeals',
        range: 'Articles 393-395',
        summary: 'Officially titles the charter as \'The Constitution of India\', declares its commencement date of 26 January 1950, provides authoritative Hindi text, and formally repealed colonial statutes.',
        keyArticles: ['Art 393: Short title — The Constitution of India', 'Art 394: Commencement on 26th January 1950 (Republic Day)', 'Art 395: Repeal of Indian Independence Act 1947 & Government of India Act 1935'],
        doctrines: 'Constitutional Autochthony (Indigenous Origin of Sovereign Legal Order)',
        details: 'Article 395 repealed colonial statutes including the Government of India Act, 1935, cementing the constitutional autochthony and indigenous sovereign legitimacy of the Republic of India.',
      },
    ];

    const filteredParts = coiParts.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.part.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.doctrines.toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder="Search Parts, Articles, or Doctrines..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.registrySearchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.subScreenScrollContent}>
          {filteredParts.map((item, index) => (
            <Card
              key={index}
              style={[styles.coiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Header: Part Badge and Article Range */}
              <View style={styles.coiCardHeader}>
                <View style={[styles.coiPartBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.coiPartBadgeText, { color: colors.primary }]}>{item.part}</Text>
                </View>
                <View style={[styles.coiRangePill, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.coiRangeText, { color: colors.textSecondary }]}>{item.range}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.coiTitle, { color: colors.text }]}>{item.title}</Text>

              {/* Summary */}
              <Text style={[styles.coiSummaryText, { color: colors.textSecondary }]}>{item.summary}</Text>

              {/* Landmark Articles Chips */}
              <View style={styles.coiKeyArticlesContainer}>
                {item.keyArticles.map((art, aIdx) => (
                  <View
                    key={aIdx}
                    style={[styles.coiArticleChip, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={[styles.coiArticleChipText, { color: colors.text }]}>{art}</Text>
                  </View>
                ))}
              </View>

              {/* Footer: Doctrines and Explore Action */}
              <View style={[styles.coiFooterRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.coiDoctrinesText, { color: colors.textLight }]} numberOfLines={1}>
                  ⚖️ {item.doctrines}
                </Text>
                <TouchableOpacity
                  style={styles.coiExploreAction}
                  activeOpacity={0.7}
                  onPress={() => {
                    setAiTitle(`${item.part}: ${item.title}`);
                    setAiSubtitle(`Constitutional Provisions (${item.range})`);
                    setAiDescription(
                      `CONSTITUTION OF INDIA — ${item.part.toUpperCase()}: ${item.title.toUpperCase()}\n` +
                      `Articles Span: ${item.range}\n\n` +
                      `OVERVIEW & CONSTITUTIONAL FRAMEWORK:\n${item.summary}\n\n` +
                      `KEY LANDMARK ARTICLES:\n${item.keyArticles.map((a) => `• ${a}`).join('\n')}\n\n` +
                      `CORE CONSTITUTIONAL DOCTRINES:\n${item.doctrines}\n\n` +
                      `IN-DEPTH STATUTORY & PROCEDURAL ANALYSIS:\n${item.details}`
                    );
                    setScreenState('ai-helper');
                    setSearchQuery('');
                  }}
                >
                  <Text style={[styles.coiExploreActionText, { color: colors.primary }]}>Explore Analysis</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
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
        sub: 'Contains all state law of India (376 Sections)',
        icon: 'map-outline',
        iconBg: 'rgba(245, 158, 11, 0.1)',
        iconColor: '#F59E0B',
        action: () => router.push('/other-law?category=State%20Laws')
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
        action: () => {
          setAiWorkspaceMode('advice');
          setScreenState('ai-helper');
          handleAIWorkspaceSubmit('Provide an overview of the Supreme Court Rules 2013, key procedures, filing timelines for Special Leave Petitions (SLP), and registry requirements.');
        }
      },
      {
        title: 'Practice and Procedure of Supreme Court',
        sub: 'How the Supreme Court Works',
        icon: 'layers-outline',
        iconBg: 'rgba(99, 102, 241, 0.1)',
        iconColor: '#6366F1',
        action: () => {
          setAiWorkspaceMode('advice');
          setScreenState('ai-helper');
          handleAIWorkspaceSubmit('Explain the practice and procedure of the Supreme Court of India: filing SLP under Article 136, Writ Petitions under Article 32, listing procedure, mentioning before CJI, and urgent hearings.');
        }
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
                onPress={() => {
                  setAiWorkspaceMode('advice');
                  setScreenState('ai-helper');
                  handleAIWorkspaceSubmit(`What are the key ${ref.label} under Indian administrative and criminal statutes, their binding nature, and legal hierarchy under Article 13 of the Constitution?`);
                }}
              >
                <Ionicons name={ref.icon as any} size={14} color={ref.color} style={{ marginRight: 6 }} />
                <Text style={[styles.quickRefText, { color: colors.text }]} numberOfLines={1}>{ref.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Repealed Acts Banner Card at Bottom */}
          <TouchableOpacity
            style={[styles.repealedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              setAiWorkspaceMode('advice');
              setScreenState('ai-helper');
              handleAIWorkspaceSubmit('Explain the transition from repealed Indian Penal Code, CrPC, and Evidence Act to Bharatiya Nyaya Sanhita, BNSS, and BSA effective July 1, 2024, and how pending cases under repealed acts are dealt with.');
            }}
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

  // Render Sub-Screen: Interactive Legal AI Workspace
  const renderAIHelper = () => {
    const activePrompts = QUICK_PROMPTS_BY_MODE[aiWorkspaceMode] || [];

    let placeholderText = 'Ask any legal question regarding Indian statutes, procedures, or rights...';
    if (aiWorkspaceMode === 'strategy') {
      placeholderText = 'Describe case facts, dispute details, or FIR scenario to get statutory strategy...';
    } else if (aiWorkspaceMode === 'judgment') {
      placeholderText = 'Search landmark cases by title (e.g. Lalita Kumari), citation, court, or legal doctrine...';
    }

    return (
      <View style={[styles.subScreenContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.subScreenHeader, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <TouchableOpacity onPress={() => setScreenState('dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.subScreenTitle, { color: colors.text, fontSize: FontSize.md }]}>
              {aiWorkspaceMode === 'advice' ? 'Legal Advice' : aiWorkspaceMode === 'strategy' ? 'Case & Doc Strategy' : 'Judgment AI'}
            </Text>
            <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>AI Statutory Intelligence</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setAiWorkspaceQuery('');
              setAiWorkspaceResult(null);
              setAiWorkspaceError(null);
            }}
            style={styles.backButton}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Mode Selector Segmented Tabs */}
        <View style={[styles.aiModeTabsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {[
            { key: 'advice', label: 'Legal Advice', icon: 'chatbubbles-outline' },
            { key: 'strategy', label: 'Case Strategy', icon: 'analytics-outline' },
            { key: 'judgment', label: 'Judgment AI', icon: 'hammer-outline' },
          ].map((tab) => {
            const isSelected = aiWorkspaceMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.aiModeTabButton,
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  !isSelected && { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
                onPress={() => {
                  setAiWorkspaceMode(tab.key as any);
                  setAiWorkspaceResult(null);
                  setAiWorkspaceError(null);
                }}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={14}
                  color={isSelected ? colors.textOnPrimary : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.aiModeTabButtonText,
                    { color: isSelected ? colors.textOnPrimary : colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.aiWorkspaceScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Active Mode Banner */}
          <View style={[styles.aiModeBannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.aiModeBannerIconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons
                name={
                  aiWorkspaceMode === 'advice'
                    ? 'chatbubbles'
                    : aiWorkspaceMode === 'strategy'
                    ? 'shield-checkmark'
                    : 'library'
                }
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiModeBannerTitle, { color: colors.text }]}>
                {aiWorkspaceMode === 'advice'
                  ? 'Instant Legal Consultation'
                  : aiWorkspaceMode === 'strategy'
                  ? 'Case Strategy & Statutory Mapping'
                  : 'Landmark Precedent & Judgment Search'}
              </Text>
              <Text style={[styles.aiModeBannerSubtitle, { color: colors.textSecondary }]}>
                {aiWorkspaceMode === 'advice'
                  ? 'Ask any query on BNS, BNSS, BSA, arrest rights, civil disputes, or consumer remedies.'
                  : aiWorkspaceMode === 'strategy'
                  ? 'Input incident facts to get applicable BNS/IPC sections, penal liabilities, and defense steps.'
                  : 'Search Supreme Court and High Court landmark cases, citations, and ratio decidendi.'}
              </Text>
            </View>
          </View>

          {/* Quick Prompts Suggestions */}
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.aiSectionSmallTitle, { color: colors.textSecondary }]}>QUICK SCENARIOS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {activePrompts.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.aiPromptChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleAIWorkspaceSubmit(p.prompt)}
                >
                  <Text style={[styles.aiPromptChipText, { color: colors.text }]}>{p.title}</Text>
                  <Ionicons name="arrow-forward-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Box Card */}
          <View style={[styles.aiInputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.aiTextInput, { color: colors.text }]}
              placeholder={placeholderText}
              placeholderTextColor={colors.textLight}
              value={aiWorkspaceQuery}
              onChangeText={setAiWorkspaceQuery}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.aiInputActionsRow}>
              {aiWorkspaceQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setAiWorkspaceQuery('')}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <TouchableOpacity
                style={[
                  styles.aiSubmitButton,
                  { backgroundColor: colors.primary, opacity: (!aiWorkspaceQuery.trim() || aiWorkspaceLoading) ? 0.6 : 1 },
                ]}
                onPress={() => handleAIWorkspaceSubmit()}
                disabled={!aiWorkspaceQuery.trim() || aiWorkspaceLoading}
              >
                {aiWorkspaceLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.aiSubmitButtonText}>
                      {aiWorkspaceMode === 'judgment' ? 'Search Precedents' : 'Analyze with AI'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Loading Indicator */}
          {aiWorkspaceLoading && (
            <View style={[styles.aiLoadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: Spacing.sm }} />
              <Text style={[styles.aiLoadingTitle, { color: colors.text }]}>Processing Legal Analysis...</Text>
              <Text style={[styles.aiLoadingSubtitle, { color: colors.textSecondary }]}>
                Scanning Bharatiya Sanhitas (BNS, BNSS, BSA), statutory provisions, and judicial precedents.
              </Text>
            </View>
          )}

          {/* Error Banner */}
          {aiWorkspaceError && !aiWorkspaceLoading && (
            <View style={[styles.aiErrorCard, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#EF4444' }]}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginRight: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: FontSize.sm }}>Request Error</Text>
                <Text style={{ color: colors.text, fontSize: FontSize.xs, marginTop: 2 }}>{aiWorkspaceError}</Text>
              </View>
              <TouchableOpacity
                style={[styles.aiRetryButton, { backgroundColor: '#EF4444' }]}
                onPress={() => handleAIWorkspaceSubmit()}
              >
                <Text style={{ color: '#FFFFFF', fontSize: FontSize.xxs, fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results Display */}
          {aiWorkspaceResult && !aiWorkspaceLoading && (
            <View style={{ marginTop: Spacing.md }}>
              {/* Suggested Sections (Case Strategy Mode) */}
              {aiWorkspaceResult.suggestedSections && aiWorkspaceResult.suggestedSections.length > 0 && (
                <View style={[styles.aiResultSectionBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.aiResultSectionHeader}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                    <Text style={[styles.aiResultSectionHeading, { color: colors.text }]}>Applicable Statutory Provisions</Text>
                  </View>
                  <View style={styles.aiSectionsBadgeRow}>
                    {aiWorkspaceResult.suggestedSections.map((sec, sIdx) => (
                      <View key={sIdx} style={[styles.aiSectionPillBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                        <Ionicons name="bookmark" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.aiSectionPillText, { color: colors.primary }]}>{sec}</Text>
                      </View>
                    ))}
                  </View>

                  {aiWorkspaceResult.details && aiWorkspaceResult.details.length > 0 && (
                    <View style={{ marginTop: Spacing.sm, gap: 8 }}>
                      {aiWorkspaceResult.details.map((item: any, dIdx: number) => (
                        <View key={dIdx} style={[styles.aiDetailRowCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.aiDetailSectionName, { color: colors.primary }]}>{item.section}</Text>
                            <Text style={[styles.aiDetailActTag, { color: colors.textSecondary }]}>{item.act}</Text>
                          </View>
                          <Text style={[styles.aiDetailTitleText, { color: colors.text }]}>{item.title}</Text>
                          <Text style={[styles.aiDetailReasonText, { color: colors.textSecondary }]}>{item.reason}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Matched Judgments (Judgment Mode) */}
              {aiWorkspaceResult.judgments && aiWorkspaceResult.judgments.length > 0 && (
                <View style={[styles.aiResultSectionBlock, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.md }]}>
                  <View style={styles.aiResultSectionHeader}>
                    <Ionicons name="hammer-outline" size={18} color="#10B981" />
                    <Text style={[styles.aiResultSectionHeading, { color: colors.text }]}>
                      Precedents in Court Registry ({aiWorkspaceResult.judgments.length})
                    </Text>
                  </View>
                  <View style={{ gap: 10, marginTop: Spacing.xs }}>
                    {aiWorkspaceResult.judgments.map((jm: any) => (
                      <View key={jm.id} style={[styles.aiJudgmentCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <Text style={[styles.aiJudgmentTitleText, { color: colors.text }]}>{jm.case_title}</Text>
                            <Text style={[styles.aiJudgmentCitation, { color: colors.primary }]}>{jm.citation || jm.case_number}</Text>
                          </View>
                          <View style={[styles.aiCourtBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#3B82F6' }}>{jm.court_name}</Text>
                          </View>
                        </View>
                        {jm.bench && (
                          <Text style={[styles.aiJudgmentBenchText, { color: colors.textSecondary }]}>Bench: {jm.bench}</Text>
                        )}
                        {jm.summary && (
                          <Text style={[styles.aiJudgmentSummaryText, { color: colors.text }]}>{jm.summary}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* AI Comprehensive Answer Card */}
              <View style={[styles.aiAnswerCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.md }]}>
                <View style={styles.aiAnswerCardHeader}>
                  <View style={[styles.aiAnswerBadge, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="sparkles" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.aiAnswerBadgeText, { color: colors.primary }]}>AI Legal Intelligence</Text>
                  </View>
                  <TouchableOpacity onPress={handleShareAIResult} style={styles.aiShareIconBtn}>
                    <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: Spacing.sm }}>
                  <MarkdownRenderer content={aiWorkspaceResult.answer} color={colors.text} />
                </View>

                {/* Sources & References */}
                {aiWorkspaceResult.sources && aiWorkspaceResult.sources.length > 0 && (
                  <View style={[styles.aiSourcesContainer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.aiSourcesTitle, { color: colors.textSecondary }]}>
                      <Ionicons name="library-outline" size={12} color={colors.primary} /> Statutory References & Authorities:
                    </Text>
                    <View style={{ gap: 6, marginTop: 4 }}>
                      {aiWorkspaceResult.sources.map((src: any, sIndex: number) => (
                        <View key={sIndex} style={[styles.aiSourceItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <Text style={[styles.aiSourceHeading, { color: colors.primary }]}>
                            {src.act} {src.section ? `• Sec. ${src.section}` : ''} {src.title ? `(${src.title})` : ''}
                          </Text>
                          {src.text_snippet && (
                            <Text style={[styles.aiSourceSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                              {src.text_snippet}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Controls */}
                <View style={[styles.aiBottomActionRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.aiActionOutlineBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                    onPress={handleShareAIResult}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                    <Text style={[styles.aiActionOutlineBtnText, { color: colors.text }]}>Share / Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.aiActionFilledBtn, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/(tabs)/fir/new')}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.aiActionFilledBtnText}>Draft FIR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
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
                setAiSubtitle('AI Precedent & Landmark Rulings Search');
                setAiDescription('Search landmark Indian judicial precedents by citation, court name, or keywords.');
                setAiWorkspaceMode('judgment');
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
                setAiSubtitle('Case Strategy & Code Comparison');
                setAiDescription('Statutory recommendations and legal defense strategy across BNS and IPC.');
                setAiWorkspaceMode('strategy');
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
                  setAiDescription('Receive guidance on legal issues, FIR drafting, and relevant sections.');
                  setAiWorkspaceMode('advice');
                  setScreenState('ai-helper');
                }
              },
              { label: 'Drafting', icon: 'create-outline', route: '/(tabs)/fir' },
              {
                label: 'Daily Poll',
                icon: 'stats-chart-outline',
                action: () => {
                  setIsPollModalOpen(true);
                }
              },
              {
                label: 'Play Quiz',
                icon: 'ribbon-outline',
                action: () => {
                  resetQuiz();
                  setIsQuizModalOpen(true);
                }
              },
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
                  <Text style={styles.drawerAvatarText}>
                    {(user?.full_name?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || 'U').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.drawerHeaderInfo}>
                  <Text style={[styles.drawerName, { color: colors.text }]} numberOfLines={1}>
                    {user?.full_name || (user?.email ? user.email.split('@')[0] : 'User')}
                  </Text>
                  <Text style={[styles.drawerEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {user?.email || 'No email registered'}
                  </Text>
                  {user?.role && (
                    <View style={styles.drawerRoleBadge}>
                      <Text style={[styles.drawerRoleText, { color: colors.primary }]}>
                        {user.role.toUpperCase()}
                      </Text>
                    </View>
                  )}
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

              {/* Logout */}
              {isAuthenticated && (
                <TouchableOpacity
                  style={[styles.drawerItemRow, { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }]}
                  onPress={async () => {
                    await logout();
                    toggleDrawer(false);
                    Alert.alert('Logged Out', 'You have been logged out.');
                  }}
                >
                  <View style={styles.drawerItemLeft}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                    <Text style={[styles.drawerItemText, { color: '#EF4444', fontWeight: '700' }]}>Sign Out</Text>
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
        animationType="slide"
        onRequestClose={() => setIsDictionaryOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.dictModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.dictModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="book" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Law Dictionary</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsDictionaryOpen(false);
                  setDictQuery('');
                  setSelectedTerm(null);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={styles.dictSearchRow}>
              <View style={[styles.dictSearchInputContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textLight} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search legal terms (e.g. bail, remand)..."
                  placeholderTextColor={colors.textLight}
                  value={dictQuery}
                  onChangeText={setDictQuery}
                  onSubmitEditing={handleSearchDictionary}
                  returnKeyType="search"
                  style={[styles.dictTextInput, { color: colors.text }]}
                />
                {dictQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setDictQuery(''); fetchDictionaryTerms('', dictCategory); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.dictSearchButton, { backgroundColor: colors.primary }]}
                onPress={handleSearchDictionary}
              >
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Category Filter Pills */}
            <View style={{ height: 36, marginVertical: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {['All', 'Criminal Procedure', 'Bail & Custody', 'Evidence Law', 'Substantive Law', 'Constitutional Law', 'FIR & Investigation'].map((cat) => {
                  const isActive = dictCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setDictCategory(cat)}
                      style={[
                        styles.dictCategoryPill,
                        {
                          backgroundColor: isActive ? colors.primary : colors.surfaceAlt,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dictCategoryText,
                          { color: isActive ? '#FFFFFF' : colors.textSecondary },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Terms List & Detail View */}
            {isDictLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: FontSize.xs }}>Searching legal repository...</Text>
              </View>
            ) : dictItems.length === 0 ? (
              <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.textLight} />
                <Text style={{ marginTop: 8, color: colors.text, fontWeight: '600' }}>No terms found</Text>
                <Text style={{ color: colors.textSecondary, fontSize: FontSize.xs, textAlign: 'center', marginTop: 4 }}>
                  Try keywords like "bail", "cognizable", "remand", or select "All".
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Horizontal chips for quick term selection */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {dictItems.map((item) => {
                    const isSelected = selectedTerm?.id === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setSelectedTerm(item)}
                        style={[
                          styles.dictTermChip,
                          {
                            backgroundColor: isSelected ? colors.primaryLight : colors.surfaceAlt,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dictTermChipText,
                            { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '500' },
                          ]}
                        >
                          {item.term}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Selected Term Detail Card */}
                {selectedTerm && (
                  <View style={[styles.dictDetailCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.dictDetailTermTitle, { color: colors.text }]}>{selectedTerm.term}</Text>
                      <View style={[styles.dictBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.dictBadgeText, { color: colors.primary }]}>{selectedTerm.category}</Text>
                      </View>
                    </View>

                    {/* Official Definition */}
                    <Text style={[styles.dictSectionHeader, { color: colors.textSecondary }]}>LEGAL DEFINITION</Text>
                    <Text style={[styles.dictDefinitionText, { color: colors.text }]}>{selectedTerm.definition}</Text>

                    {/* In Simple Words */}
                    <View style={[styles.dictSimpleBox, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF', borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                        <Text style={[styles.dictSimpleHeader, { color: colors.primary }]}>In Simple Words</Text>
                      </View>
                      <Text style={[styles.dictSimpleText, { color: colors.text }]}>{selectedTerm.simple_explanation}</Text>
                    </View>

                    {/* Related Provisions */}
                    {selectedTerm.related_provisions && selectedTerm.related_provisions.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.dictSectionHeader, { color: colors.textSecondary }]}>STATUTORY REFERENCES</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {selectedTerm.related_provisions.map((prov, idx) => (
                            <View key={idx} style={[styles.dictProvisionPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                              <Ionicons name="document-text-outline" size={12} color={colors.primary} />
                              <Text style={[styles.dictProvisionText, { color: colors.text }]}>{prov}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Examples */}
                    {selectedTerm.examples && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.dictSectionHeader, { color: colors.textSecondary }]}>PRACTICAL APPLICATION</Text>
                        <Text style={[styles.dictExampleText, { color: colors.textSecondary }]}>{selectedTerm.examples}</Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Daily Poll Modal */}
      <Modal
        visible={isPollModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPollModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.pollModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.pollHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="stats-chart" size={18} color={colors.primary} />
                  <Text style={{ fontSize: FontSize.xxs, fontWeight: '800', color: colors.primary, letterSpacing: 0.8 }}>
                    COMMUNITY LEGAL POLL
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  Today's Debate • Bharatiya Nagarik Suraksha Sanhita
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsPollModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.pollQuestionText, { color: colors.text }]}>
                Will mandatory audio-video electronic recording of search and seizure under Section 105 BNSS accelerate convictions in criminal trials?
              </Text>

              {/* Options List */}
              {[
                'Significantly improves transparency and curbs fabricated recoveries',
                'Agree in principle, but police forensic infrastructure needs urgent expansion',
                'Disagree: May cause procedural technicalities and trial delays in urgent raids',
                'Neutral: Awaiting empirical High Court trial data and digital guidelines',
              ].map((optionText, optIdx) => {
                const totalVotes = pollVoteCounts.reduce((a, b) => a + b, 0);
                const count = pollVoteCounts[optIdx] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isUserChoice = userPollVote === optIdx;
                const isSelectedForVote = pollSelectedOption === optIdx;

                return (
                  <TouchableOpacity
                    key={optIdx}
                    disabled={userPollVote !== null}
                    onPress={() => setPollSelectedOption(optIdx)}
                    style={[
                      styles.pollOptionCard,
                      {
                        backgroundColor: isUserChoice
                          ? 'rgba(16, 185, 129, 0.08)'
                          : isSelectedForVote
                          ? colors.primaryLight
                          : colors.surfaceAlt,
                        borderColor: isUserChoice
                          ? '#10B981'
                          : isSelectedForVote
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <Ionicons
                          name={
                            isUserChoice
                              ? 'checkmark-circle'
                              : isSelectedForVote
                              ? 'radio-button-on'
                              : userPollVote !== null
                              ? 'radio-button-off'
                              : 'ellipse-outline'
                          }
                          size={18}
                          color={isUserChoice ? '#10B981' : isSelectedForVote ? colors.primary : colors.textLight}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={{ fontSize: FontSize.xs, color: colors.text, flex: 1, fontWeight: isUserChoice ? '700' : '500' }}>
                          {optionText}
                        </Text>
                      </View>

                      {userPollVote !== null && (
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: isUserChoice ? '#10B981' : colors.primary }}>
                          {pct}%
                        </Text>
                      )}
                    </View>

                    {/* Animated percentage bar if voted */}
                    {userPollVote !== null && (
                      <View style={styles.pollBarContainer}>
                        <View
                          style={[
                            styles.pollBarFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: isUserChoice ? '#10B981' : colors.primary,
                            },
                          ]}
                        />
                      </View>
                    )}

                    {userPollVote !== null && isUserChoice && (
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981', marginTop: 2 }}>
                        ✓ YOUR VOTE
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Total votes */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: Spacing.sm }}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: FontSize.xxs, color: colors.textSecondary }}>
                  {pollVoteCounts.reduce((a, b) => a + b, 0).toLocaleString()} Verified Legal Practitioners Voted
                </Text>
              </View>

              {/* Legal Context Card */}
              <View style={[styles.pollInsightCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.text }}>
                    Statutory Context: Section 105 BNSS, 2023
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize.xxs, color: colors.textSecondary, lineHeight: 16 }}>
                  Section 105 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 mandates that search of a place or seizure of any property shall be recorded through audio-video electronic means (e.g. mobile phone). The digital evidence must be forwarded without delay to the Judicial Magistrate to safeguard against trial challenges.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ marginTop: Spacing.xs, marginBottom: Spacing.sm }}>
                {userPollVote === null ? (
                  <TouchableOpacity
                    style={[
                      styles.aiSubmitButton,
                      {
                        backgroundColor: colors.primary,
                        justifyContent: 'center',
                        opacity: pollSelectedOption === null ? 0.5 : 1,
                      },
                    ]}
                    disabled={pollSelectedOption === null}
                    onPress={() => {
                      if (pollSelectedOption !== null) handleVotePoll(pollSelectedOption);
                    }}
                  >
                    <Text style={styles.aiSubmitButtonText}>Submit Vote</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.aiActionOutlineBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                      onPress={() => {
                        setUserPollVote(null);
                        setPollSelectedOption(null);
                      }}
                    >
                      <Text style={[styles.aiActionOutlineBtnText, { color: colors.textSecondary }]}>Change Vote</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.aiActionFilledBtn, { backgroundColor: colors.primary }]}
                      onPress={() => setIsPollModalOpen(false)}
                    >
                      <Text style={styles.aiActionFilledBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Legal Mastery Quiz Modal */}
      <Modal
        visible={isQuizModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsQuizModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.quizModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.pollHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="ribbon" size={18} color={colors.primary} />
                  <Text style={{ fontSize: FontSize.xxs, fontWeight: '800', color: colors.primary, letterSpacing: 0.8 }}>
                    SANHITA & STATUTES MASTERY QUIZ
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  Test your knowledge on BNS, BNSS, BSA & Indian Law
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsQuizModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!quizFinished ? (
                <>
                  {/* Progress & Score Bar */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {QUIZ_QUESTIONS.map((_, dotIdx) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.quizStepDot,
                            {
                              backgroundColor:
                                dotIdx === quizIndex
                                  ? colors.primary
                                  : dotIdx < quizIndex
                                  ? '#10B981'
                                  : colors.border,
                            },
                          ]}
                        />
                      ))}
                      <Text style={{ fontSize: FontSize.xxs, fontWeight: '700', color: colors.textSecondary, marginLeft: 4 }}>
                        Question {quizIndex + 1} of {QUIZ_QUESTIONS.length}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: colors.text }}>
                        Score: {quizScore} / {QUIZ_QUESTIONS.length}
                      </Text>
                    </View>
                  </View>

                  {/* Question Text */}
                  <Text style={[styles.pollQuestionText, { color: colors.text, fontSize: FontSize.md }]}>
                    {QUIZ_QUESTIONS[quizIndex].question}
                  </Text>

                  {/* Options List */}
                  {QUIZ_QUESTIONS[quizIndex].options.map((optText, optIdx) => {
                    const isCorrect = optIdx === QUIZ_QUESTIONS[quizIndex].correctIndex;
                    const isSelected = optIdx === quizSelectedOption;

                    let btnBg = colors.surfaceAlt;
                    let btnBorder = colors.border;
                    let letterColor = colors.textSecondary;

                    if (quizIsAnswered) {
                      if (isCorrect) {
                        btnBg = 'rgba(16, 185, 129, 0.12)';
                        btnBorder = '#10B981';
                        letterColor = '#10B981';
                      } else if (isSelected && !isCorrect) {
                        btnBg = 'rgba(239, 68, 68, 0.12)';
                        btnBorder = '#EF4444';
                        letterColor = '#EF4444';
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={optIdx}
                        disabled={quizIsAnswered}
                        onPress={() => handleSelectQuizOption(optIdx)}
                        style={[styles.quizOptionBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
                      >
                        <View
                          style={[
                            styles.quizOptionLetterBox,
                            {
                              backgroundColor:
                                quizIsAnswered && isCorrect
                                  ? '#10B981'
                                  : quizIsAnswered && isSelected
                                  ? '#EF4444'
                                  : colors.surface,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: FontSize.xs,
                              fontWeight: '800',
                              color:
                                quizIsAnswered && (isCorrect || isSelected)
                                  ? '#FFFFFF'
                                  : letterColor,
                            }}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: FontSize.xs, color: colors.text, fontWeight: isCorrect && quizIsAnswered ? '700' : '500' }}>
                          {optText}
                        </Text>
                        {quizIsAnswered && isCorrect && (
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        )}
                        {quizIsAnswered && isSelected && !isCorrect && (
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Statutory Explanation Card */}
                  {quizIsAnswered && (
                    <View style={[styles.quizExplanationCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.text }}>
                          Statutory Rationale
                        </Text>
                      </View>
                      <Text style={{ fontSize: FontSize.xxs, color: colors.textSecondary, lineHeight: 16 }}>
                        {QUIZ_QUESTIONS[quizIndex].explanation}
                      </Text>
                    </View>
                  )}

                  {/* Next Question / Finish Button */}
                  {quizIsAnswered && (
                    <TouchableOpacity
                      style={[styles.aiActionFilledBtn, { backgroundColor: colors.primary, marginTop: Spacing.xs, paddingVertical: 12 }]}
                      onPress={handleNextQuizQuestion}
                    >
                      <Text style={styles.aiActionFilledBtnText}>
                        {quizIndex < QUIZ_QUESTIONS.length - 1 ? 'Next Question →' : 'See Final Results 🎉'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                /* Quiz Completion View */
                <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: Spacing.md,
                    }}
                  >
                    <Ionicons name="trophy" size={38} color="#F59E0B" />
                  </View>

                  <Text style={{ fontSize: FontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                    Quiz Completed!
                  </Text>
                  <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 4 }}>
                    Your Score: {quizScore} out of {QUIZ_QUESTIONS.length} ({Math.round((quizScore / QUIZ_QUESTIONS.length) * 100)}%)
                  </Text>

                  {/* Rank Badge */}
                  <View
                    style={{
                      paddingHorizontal: Spacing.md,
                      paddingVertical: 6,
                      borderRadius: BorderRadius.full,
                      backgroundColor: colors.primaryLight,
                      marginTop: Spacing.md,
                      marginBottom: Spacing.lg,
                    }}
                  >
                    <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: colors.primary }}>
                      {quizScore === 5
                        ? '🏆 Supreme Jurist • Perfect Sanhita Score!'
                        : quizScore >= 4
                        ? '⚖️ Senior Advocate • Excellent Mastery!'
                        : quizScore >= 3
                        ? '📚 Legal Scholar • Good Foundation!'
                        : '🎓 Law Apprentice • Keep Exploring Sanhitas!'}
                    </Text>
                  </View>

                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg, paddingHorizontal: Spacing.md }}>
                    Keep up to date with the latest transitions across the Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA).
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.aiActionOutlineBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                      onPress={resetQuiz}
                    >
                      <Ionicons name="reload-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                      <Text style={[styles.aiActionOutlineBtnText, { color: colors.text }]}>Play Again</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.aiActionFilledBtn, { backgroundColor: colors.primary }]}
                      onPress={() => setIsQuizModalOpen(false)}
                    >
                      <Text style={styles.aiActionFilledBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  drawerRoleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    marginTop: 4,
  },
  drawerRoleText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  comparisonHeader: {
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  comparisonSubtitle: {
    fontSize: FontSize.xs,
    marginTop: 2,
    textAlign: 'center',
  },
  comparisonCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
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
  badgeSubText: {
    fontSize: FontSize.xxs,
    color: '#FFFFFF',
    marginTop: 2,
    opacity: 0.9,
    fontWeight: '600',
  },
  vsText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  comparisonMiddleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 70,
  },
  comparisonMiddleCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  comparisonMiddleText: {
    fontSize: FontSize.xxs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  comparisonMiddleSubText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    marginTop: 1,
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
  badgeSubTextOld: {
    fontSize: FontSize.xxs,
    marginTop: 2,
    fontWeight: '600',
  },
  comparisonHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  comparisonHighlightText: {
    fontSize: FontSize.xs,
    flex: 1,
    lineHeight: 16,
  },
  openConverterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  openConverterBarText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
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
  courtCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  courtCardTop: {
    marginBottom: Spacing.sm,
  },
  courtCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  courtMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  courtMetaText: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  courtOverviewText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  courtServicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  courtServiceChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  courtServiceChipText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  courtActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  courtActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.xs,
  },
  courtActionText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
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

  // Constitution of India (COI) styles
  coiCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  coiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  coiPartBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  coiPartBadgeText: {
    fontSize: FontSize.xxs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coiRangePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  coiRangeText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  coiTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  coiSummaryText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  coiKeyArticlesContainer: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  coiArticleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  coiArticleChipText: {
    fontSize: FontSize.xxs,
    lineHeight: 14,
  },
  coiFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  coiDoctrinesText: {
    fontSize: FontSize.xxs,
    fontStyle: 'italic',
    flex: 1,
  },
  coiExploreAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  coiExploreActionText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
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

  // Law Dictionary Modal Styles
  dictModalCard: {
    width: '100%',
    maxWidth: 580,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.lg,
  },
  dictModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  dictSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dictSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  dictTextInput: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.sm,
  },
  dictSearchButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dictCategoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dictCategoryText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  dictTermChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dictTermChipText: {
    fontSize: FontSize.xs,
  },
  dictDetailCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: 4,
  },
  dictDetailTermTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  dictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  dictBadgeText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dictSectionHeader: {
    fontSize: FontSize.xxs,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  dictDefinitionText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '400',
  },
  dictSimpleBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: 8,
  },
  dictSimpleHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  dictSimpleText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  dictProvisionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dictProvisionText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  dictExampleText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // AI Suite Workspace styles
  aiModeTabsBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
  },
  aiModeTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  aiModeTabButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  aiWorkspaceScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl * 2,
  },
  aiModeBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  aiModeBannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  aiModeBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiModeBannerSubtitle: {
    fontSize: FontSize.xxs,
    lineHeight: 16,
  },
  aiSectionSmallTitle: {
    fontSize: FontSize.xxs,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  aiPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  aiPromptChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  aiInputCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  aiTextInput: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    minHeight: 80,
    padding: 0,
    marginBottom: Spacing.sm,
  },
  aiInputActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
    paddingTop: Spacing.sm,
  },
  aiSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  aiSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  aiLoadingCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  aiLoadingTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  aiLoadingSubtitle: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  aiErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  aiRetryButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  aiResultSectionBlock: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  aiResultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  aiResultSectionHeading: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  aiSectionsBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  aiSectionPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  aiSectionPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  aiDetailRowCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  aiDetailSectionName: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  aiDetailActTag: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  aiDetailTitleText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  aiDetailReasonText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  aiJudgmentCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  aiJudgmentTitleText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  aiJudgmentCitation: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  aiCourtBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  aiJudgmentBenchText: {
    fontSize: FontSize.xxs,
    fontStyle: 'italic',
    marginTop: 4,
  },
  aiJudgmentSummaryText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: 6,
  },
  aiAnswerCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  aiAnswerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiAnswerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  aiAnswerBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  aiShareIconBtn: {
    padding: 6,
  },
  aiSourcesContainer: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  aiSourcesTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 6,
  },
  aiSourceItem: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  aiSourceHeading: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiSourceSnippet: {
    fontSize: FontSize.xxs,
    lineHeight: 16,
  },
  aiBottomActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  aiActionOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  aiActionOutlineBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  aiActionFilledBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  aiActionFilledBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },

  // Daily Poll & Quiz Modal Styles
  pollModalCard: {
    width: '92%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  pollQuestionText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  pollOptionCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pollBarContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(150,150,150,0.15)',
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  pollBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  pollInsightCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quizModalCard: {
    width: '92%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  quizStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quizOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  quizOptionLetterBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  quizExplanationCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
});

