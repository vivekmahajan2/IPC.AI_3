import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import StatusBadge from '../../../components/ui/StatusBadge';
import { useTheme } from '../../../context/ThemeContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { FIRDraft } from '../../../types';

export default function FIRDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const { data: fir, isLoading } = useQuery({
    queryKey: ['fir', id],
    queryFn: async () => {
      const res = await api.get(`/fir/${id}`);
      return res.data as FIRDraft;
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/fir/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fir', id] });
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      Alert.alert('Success', 'FIR submitted for review');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/fir/${id}/approve`, { comments: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fir', id] });
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      Alert.alert('Success', 'FIR approved');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/fir/${id}/reject`, { comments: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fir', id] });
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      Alert.alert('Success', 'FIR rejected');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed'),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/fir/${id}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fir', id] });
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      Alert.alert('Success', 'FIR finalized and official PDF generated!');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed'),
  });

  const { data: auditTrail } = useQuery({
    queryKey: ['fir-audit', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/fir/${id}/audit`);
        return res.data as any[];
      } catch (e) {
        return [];
      }
    },
    enabled: !!id,
  });

  const { data: proceduralData } = useQuery({
    queryKey: ['fir-procedural', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/fir/${id}/procedural-suggestions`);
        return res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!id,
  });

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/fir/${id}/pdf`);
      const pdfUrl = res.data?.pdf_url;
      if (!pdfUrl) {
        Alert.alert('Error', 'PDF download URL not found.');
        return;
      }
      const fullUrl = pdfUrl.startsWith('http')
        ? pdfUrl
        : `${api.defaults.baseURL || 'http://127.0.0.1:8000'}${pdfUrl}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(fullUrl, '_blank');
      } else {
        await Linking.openURL(fullUrl);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to download FIR PDF.');
    }
  };

  if (isLoading || !fir) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading FIR details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const details = fir.incident_details || {};
  const isSuperior = user?.role === 'superior' || user?.role === 'admin';

  const renderDetailRow = (label: string, value?: string) => {
    if (!value) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>FIR Details</Text>
        <StatusBadge status={fir.status} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title & FIR Number */}
        <Card style={styles.section}>
          <Text style={[styles.firTitle, { color: colors.text }]}>{fir.title}</Text>
          {fir.fir_number && (
            <Text style={[styles.firNumber, { color: colors.textSecondary }]}>{fir.fir_number}</Text>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Created: {new Date(fir.created_at).toLocaleDateString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Complainant Details */}
        {(details.complainant_name || details.complainant_address) && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Complainant</Text>
            {renderDetailRow('Name', details.complainant_name)}
            {renderDetailRow("Father's Name", details.complainant_father_name)}
            {renderDetailRow('Address', details.complainant_address)}
            {renderDetailRow('Phone', details.complainant_phone)}
          </Card>
        )}

        {/* Incident Details */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Incident Details</Text>
          {renderDetailRow('Date', details.incident_date)}
          {renderDetailRow('Time', details.incident_time)}
          {renderDetailRow('Place', details.incident_place)}
          {renderDetailRow('District', details.district)}
          {details.description && (
            <View style={styles.descriptionBlock}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.text }]}>{details.description}</Text>
            </View>
          )}
        </Card>

        {/* Accused */}
        {(details.accused_name || details.accused_description) && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Accused</Text>
            {renderDetailRow('Name', details.accused_name)}
            {renderDetailRow('Description', details.accused_description)}
          </Card>
        )}

        {/* Sections Applied */}
        {fir.sections_applied && fir.sections_applied.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sections Applied</Text>
            <View style={styles.sectionsRow}>
              {fir.sections_applied.map((s, i) => (
                <View key={i} style={[styles.sectionChip, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.sectionChipText, { color: colors.primary }]}>{s}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* BNSS Procedural Guidance (Automatic Suggestions Engine) */}
        {proceduralData && proceduralData.steps?.length > 0 && (
          <Card style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                  Procedural Guidance (BNSS)
                </Text>
              </View>
              <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                  {Object.values(completedSteps).filter(Boolean).length} / {proceduralData.steps.length} DONE
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              {proceduralData.summary}
            </Text>
            {proceduralData.steps.map((st: any) => {
              const isDone = !!completedSteps[st.id];
              return (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => toggleStep(st.id)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    backgroundColor: isDone ? colors.surfaceAlt : colors.surface,
                    borderColor: isDone ? colors.success : colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={isDone ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isDone ? colors.success : colors.textSecondary}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDone ? colors.textSecondary : colors.text, textDecorationLine: isDone ? 'line-through' : 'none' }}>
                        {st.title}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: st.priority === 'HIGH' ? colors.error : colors.warning }}>
                        {st.bnss_section}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                      {st.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Review Comments */}
        {fir.review_comments && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Review Comments</Text>
            <Text style={[styles.reviewComments, { color: colors.textSecondary }]}>{fir.review_comments}</Text>
          </Card>
        )}

        {/* Audit & Approval Trail */}
        {auditTrail && auditTrail.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Audit & Approval Trail</Text>
            {auditTrail.map((entry: any, index: number) => (
              <View
                key={entry.id || index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                    marginTop: 6,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
                    {entry.action} {entry.user_name ? `by ${entry.user_name}` : ''}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {new Date(entry.timestamp).toLocaleString('en-IN')}
                  </Text>
                  {entry.details?.comments ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' }}>
                      "{entry.details.comments}"
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {fir.status === 'draft' && fir.user_id === user?.id && (
            <Button
              title="Submit for Review"
              onPress={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
              fullWidth
              icon={<Ionicons name="send-outline" size={18} color={colors.textOnPrimary} />}
            />
          )}

          {['submitted', 'under_review'].includes(fir.status) && isSuperior && (
            <View style={styles.reviewActions}>
              <Button
                title="Approve"
                variant="primary"
                onPress={() => approveMutation.mutate()}
                loading={approveMutation.isPending}
                style={styles.reviewButton}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.textOnPrimary} />}
              />
              <Button
                title="Reject"
                variant="danger"
                onPress={() => rejectMutation.mutate()}
                loading={rejectMutation.isPending}
                style={styles.reviewButton}
                icon={<Ionicons name="close-circle-outline" size={18} color={colors.textOnPrimary} />}
              />
            </View>
          )}

          {fir.status === 'approved' && (
            <Button
              title="Finalize & Generate PDF"
              onPress={() => finalizeMutation.mutate()}
              loading={finalizeMutation.isPending}
              fullWidth
              icon={<Ionicons name="document-outline" size={18} color={Colors.textOnPrimary} />}
            />
          )}

          {fir.status === 'finalized' && (
            <Button
              title="Download Official FIR PDF"
              variant="primary"
              onPress={handleDownloadPDF}
              fullWidth
              icon={<Ionicons name="download-outline" size={18} color={colors.textOnPrimary} />}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginHorizontal: Spacing.md,
  },

  // Content
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  firTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  firNumber: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Details
  detailRow: {
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  descriptionBlock: {
    marginTop: Spacing.sm,
  },
  descriptionText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },

  // Sections
  sectionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sectionChip: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  sectionChipText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Review
  reviewComments: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Actions
  actions: {
    marginTop: Spacing.md,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  reviewButton: {
    flex: 1,
  },
});
