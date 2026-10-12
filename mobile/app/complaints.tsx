import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

export default function ComplaintsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const isOfficer = ['police', 'superior', 'admin'].includes(user?.role || '');

  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');

  // New complaint form state
  const [title, setTitle] = useState('');
  const [complainantName, setComplainantName] = useState(user?.full_name || '');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [incidentPlace, setIncidentPlace] = useState('');
  const [description, setDescription] = useState('');
  const [suspectDetails, setSuspectDetails] = useState('');

  // Fetch complaints
  const endpoint = isOfficer ? '/complaints' : '/complaints/my';
  const { data: complaints, isLoading, refetch } = useQuery({
    queryKey: ['complaints', endpoint],
    queryFn: async () => {
      const res = await api.get(endpoint);
      return res.data as any[];
    },
  });

  // Create Complaint Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return await api.post('/complaints', {
        title,
        incident_details: {
          complainant_name: complainantName,
          complainant_phone: complainantPhone,
          incident_date: incidentDate,
          incident_place: incidentPlace,
          description,
          suspect_details: suspectDetails,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      Alert.alert('Complaint Registered', 'Your complaint has been submitted successfully to the police department.');
      setTitle('');
      setDescription('');
      setIncidentPlace('');
      setSuspectDetails('');
      setActiveTab('list');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to submit complaint'),
  });

  // Convert to FIR Mutation (for Police)
  const convertMutation = useMutation({
    mutationFn: async (complaintId: number) => {
      return await api.post(`/complaints/${complaintId}/convert-to-fir`);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      const firId = res.data?.fir_id;
      Alert.alert(
        'Converted to FIR',
        'Official FIR draft created from this complaint. Opening FIR editor...',
        [
          {
            text: 'Open FIR',
            onPress: () => {
              if (firId) {
                router.push(`/(tabs)/fir/${firId}` as any);
              }
            },
          },
        ]
      );
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to convert complaint to FIR'),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted_to_fir':
        return colors.success;
      case 'under_inquiry':
        return colors.primary;
      case 'closed':
        return colors.textLight;
      default:
        return colors.warning;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isOfficer ? 'Citizen Complaints Desk' : 'My Legal Complaints'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'list' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'list' ? colors.primary : colors.textSecondary }]}>
            {isOfficer ? 'All Complaints' : 'My Complaints'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'new' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'new' ? colors.primary : colors.textSecondary }]}>
            + File Complaint
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'new' ? (
          /* Complaint Filing Form */
          <Card>
            <Text style={[styles.formTitle, { color: colors.text }]}>Submit Incident Complaint</Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
              Official legal record under Bharatiya Nagarik Suraksha Sanhita (BNSS).
            </Text>

            <Input
              label="Subject / Complaint Title"
              placeholder="e.g., House break-in and theft of jewelry"
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Complainant Name"
              placeholder="Your full legal name"
              value={complainantName}
              onChangeText={setComplainantName}
            />

            <Input
              label="Contact Phone"
              placeholder="Mobile number"
              value={complainantPhone}
              onChangeText={setComplainantPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Date of Incident"
              placeholder="YYYY-MM-DD"
              value={incidentDate}
              onChangeText={setIncidentDate}
            />

            <Input
              label="Place of Occurrence"
              placeholder="Street, Landmark, City, District"
              value={incidentPlace}
              onChangeText={setIncidentPlace}
            />

            <Input
              label="Detailed Incident Description"
              placeholder="Provide exact sequence of events, times, weapons/instruments used, losses suffered..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />

            <Input
              label="Suspect / Accused Details (If Known)"
              placeholder="Names, physical descriptions, vehicle numbers, or 'Unknown'"
              value={suspectDetails}
              onChangeText={setSuspectDetails}
              multiline
              numberOfLines={3}
            />

            <Button
              title="Submit Complaint"
              variant="primary"
              onPress={() => {
                if (!title.trim() || !description.trim()) {
                  Alert.alert('Required', 'Please fill in both the Subject and Description.');
                  return;
                }
                createMutation.mutate();
              }}
              loading={createMutation.isPending}
              style={{ marginTop: 12 }}
              icon={<Ionicons name="paper-plane-outline" size={18} color={colors.textOnPrimary} />}
            />
          </Card>
        ) : (
          /* Complaints List */
          <View>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : complaints && complaints.length > 0 ? (
              complaints.map((c: any) => {
                const details = c.incident_details || {};
                const statusColor = getStatusColor(c.status);
                return (
                  <Card key={c.id} style={{ marginBottom: 14 }}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.complaintNumber, { color: colors.primary }]}>{c.complaint_number}</Text>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{c.title}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {c.status.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                      Filed: {new Date(c.created_at).toLocaleDateString('en-IN')} | Place: {details.incident_place || 'Not specified'}
                    </Text>

                    <Text style={[styles.cardDesc, { color: colors.text }]} numberOfLines={3}>
                      {details.description || 'No description provided.'}
                    </Text>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                      {c.fir_id ? (
                        <TouchableOpacity
                          style={[styles.firLinkBtn, { backgroundColor: colors.primaryLight }]}
                          onPress={() => router.push(`/(tabs)/fir/${c.fir_id}` as any)}
                        >
                          <Ionicons name="document-text" size={16} color={colors.primary} />
                          <Text style={[styles.firLinkText, { color: colors.primary }]}>View Generated FIR</Text>
                        </TouchableOpacity>
                      ) : null}

                      {isOfficer && c.status !== 'converted_to_fir' ? (
                        <Button
                          title="Convert to FIR Draft"
                          size="sm"
                          variant="primary"
                          onPress={() => convertMutation.mutate(c.id)}
                          loading={convertMutation.isPending}
                          icon={<Ionicons name="arrow-forward" size={16} color={colors.textOnPrimary} />}
                        />
                      ) : null}
                    </View>
                  </Card>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={56} color={colors.textLight} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Complaints Found</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {isOfficer
                    ? 'No complaints currently pending at your station.'
                    : 'You have not submitted any complaints yet. Click "+ File Complaint" above.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  formTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  complaintNumber: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: FontSize.xs,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  firLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
  },
  firLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
});
