import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
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
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { FIRDraft } from '../../../types';

export default function FIRDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      Alert.alert('Success', 'FIR finalized');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed'),
  });

  if (isLoading || !fir) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading FIR details...</Text>
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
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>FIR Details</Text>
        <StatusBadge status={fir.status} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title & FIR Number */}
        <Card style={styles.section}>
          <Text style={styles.firTitle}>{fir.title}</Text>
          {fir.fir_number && (
            <Text style={styles.firNumber}>{fir.fir_number}</Text>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>
              Created: {new Date(fir.created_at).toLocaleDateString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Complainant Details */}
        {(details.complainant_name || details.complainant_address) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Complainant</Text>
            {renderDetailRow('Name', details.complainant_name)}
            {renderDetailRow("Father's Name", details.complainant_father_name)}
            {renderDetailRow('Address', details.complainant_address)}
            {renderDetailRow('Phone', details.complainant_phone)}
          </Card>
        )}

        {/* Incident Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Incident Details</Text>
          {renderDetailRow('Date', details.incident_date)}
          {renderDetailRow('Time', details.incident_time)}
          {renderDetailRow('Place', details.incident_place)}
          {renderDetailRow('District', details.district)}
          {details.description && (
            <View style={styles.descriptionBlock}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.descriptionText}>{details.description}</Text>
            </View>
          )}
        </Card>

        {/* Accused */}
        {(details.accused_name || details.accused_description) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Accused</Text>
            {renderDetailRow('Name', details.accused_name)}
            {renderDetailRow('Description', details.accused_description)}
          </Card>
        )}

        {/* Sections Applied */}
        {fir.sections_applied && fir.sections_applied.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Sections Applied</Text>
            <View style={styles.sectionsRow}>
              {fir.sections_applied.map((s, i) => (
                <View key={i} style={styles.sectionChip}>
                  <Text style={styles.sectionChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Review Comments */}
        {fir.review_comments && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Review Comments</Text>
            <Text style={styles.reviewComments}>{fir.review_comments}</Text>
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
              icon={<Ionicons name="send-outline" size={18} color={Colors.textOnPrimary} />}
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
                icon={<Ionicons name="checkmark-circle-outline" size={18} color={Colors.textOnPrimary} />}
              />
              <Button
                title="Reject"
                variant="danger"
                onPress={() => rejectMutation.mutate()}
                loading={rejectMutation.isPending}
                style={styles.reviewButton}
                icon={<Ionicons name="close-circle-outline" size={18} color={Colors.textOnPrimary} />}
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
