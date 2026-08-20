import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import api from '../../../lib/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { IncidentDetails } from '../../../types';
import { saveOfflineFIR } from '../../../lib/db';

// Simple UUID v4 generator (no external dependency needed)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewFIRScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [sections, setSections] = useState('');
  const [details, setDetails] = useState<IncidentDetails>({
    complainant_name: '',
    complainant_father_name: '',
    complainant_address: '',
    complainant_phone: '',
    incident_date: '',
    incident_time: '',
    incident_place: '',
    district: '',
    accused_name: '',
    accused_description: '',
    description: '',
    witness_details: '',
    property_stolen: '',
    property_value: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['Basic Info', 'Complainant', 'Incident', 'Accused & Sections'];

  const updateDetail = (key: keyof IncidentDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const sectionsArray = sections
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const clientUuid = generateUUID();
      const firData = {
        client_uuid: clientUuid,
        title,
        incident_details: details,
        sections_applied: sectionsArray,
      };

      try {
        // Try to create on the server
        return await api.post('/fir', firData);
      } catch (error: any) {
        // If network error, save offline
        if (!error?.response && Platform.OS !== 'web') {
          saveOfflineFIR(firData);
          return { data: { ...firData, id: -1, status: 'draft', offline: true } };
        }
        throw error;
      }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['firs'] });
      queryClient.invalidateQueries({ queryKey: ['firs-recent'] });
      const isOffline = result?.data?.offline;
      Alert.alert(
        'Success',
        isOffline
          ? 'FIR draft saved offline. It will sync when you reconnect.'
          : 'FIR draft created successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to create FIR');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a title for the FIR');
      return;
    }
    createMutation.mutate();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View>
            <Input
              label="FIR Title"
              placeholder="e.g., Theft at Main Market, Ward 5"
              value={title}
              onChangeText={setTitle}
              required
            />
            <Input
              label="Date of FIR"
              placeholder="DD-MM-YYYY"
              value={details.incident_date || ''}
              onChangeText={(v) => updateDetail('incident_date', v)}
            />
            <Input
              label="District"
              placeholder="e.g., Central Delhi"
              value={details.district || ''}
              onChangeText={(v) => updateDetail('district', v)}
            />
          </View>
        );
      case 1:
        return (
          <View>
            <Input
              label="Complainant Name"
              placeholder="Full name"
              value={details.complainant_name || ''}
              onChangeText={(v) => updateDetail('complainant_name', v)}
            />
            <Input
              label="Father's / Husband's Name"
              placeholder="Full name"
              value={details.complainant_father_name || ''}
              onChangeText={(v) => updateDetail('complainant_father_name', v)}
            />
            <Input
              label="Address"
              placeholder="Full address"
              value={details.complainant_address || ''}
              onChangeText={(v) => updateDetail('complainant_address', v)}
              multiline
              numberOfLines={3}
            />
            <Input
              label="Phone"
              placeholder="Phone number"
              value={details.complainant_phone || ''}
              onChangeText={(v) => updateDetail('complainant_phone', v)}
              keyboardType="phone-pad"
            />
          </View>
        );
      case 2:
        return (
          <View>
            <Input
              label="Time of Incident"
              placeholder="HH:MM"
              value={details.incident_time || ''}
              onChangeText={(v) => updateDetail('incident_time', v)}
            />
            <Input
              label="Place of Occurrence"
              placeholder="Exact location"
              value={details.incident_place || ''}
              onChangeText={(v) => updateDetail('incident_place', v)}
            />
            <Input
              label="Description of Offence"
              placeholder="Detailed description of the incident..."
              value={details.description || ''}
              onChangeText={(v) => updateDetail('description', v)}
              multiline
              numberOfLines={6}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
            <Input
              label="Witness Details"
              placeholder="Names and details of witnesses"
              value={details.witness_details || ''}
              onChangeText={(v) => updateDetail('witness_details', v)}
              multiline
              numberOfLines={3}
            />
          </View>
        );
      case 3:
        return (
          <View>
            <Input
              label="Name of Accused"
              placeholder="Full name (if known)"
              value={details.accused_name || ''}
              onChangeText={(v) => updateDetail('accused_name', v)}
            />
            <Input
              label="Description of Accused"
              placeholder="Physical description, identifying marks"
              value={details.accused_description || ''}
              onChangeText={(v) => updateDetail('accused_description', v)}
              multiline
              numberOfLines={3}
            />
            <Input
              label="Property Stolen / Involved"
              placeholder="Description of property"
              value={details.property_stolen || ''}
              onChangeText={(v) => updateDetail('property_stolen', v)}
            />
            <Input
              label="Estimated Value (₹)"
              placeholder="e.g., 50000"
              value={details.property_value || ''}
              onChangeText={(v) => updateDetail('property_value', v)}
              keyboardType="numeric"
            />
            <Input
              label="Sections Applied"
              placeholder="e.g., IPC 302, IPC 307, BNS 103"
              value={sections}
              onChangeText={setSections}
              hint="Comma-separated section numbers"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New FIR Draft</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicators */}
      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <TouchableOpacity
            key={step}
            style={styles.stepItem}
            onPress={() => setCurrentStep(index)}
          >
            <View
              style={[
                styles.stepDot,
                index === currentStep && styles.stepDotActive,
                index < currentStep && styles.stepDotDone,
              ]}
            >
              {index < currentStep ? (
                <Ionicons name="checkmark" size={12} color={Colors.textOnPrimary} />
              ) : (
                <Text style={[styles.stepNumber, index === currentStep && styles.stepNumberActive]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[styles.stepLabel, index === currentStep && styles.stepLabelActive]}
            >
              {step}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form */}
      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          {renderStepContent()}
        </Card>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.bottomBar}>
        {currentStep > 0 && (
          <Button
            title="Previous"
            variant="outline"
            onPress={() => setCurrentStep((p) => p - 1)}
            style={styles.navButton}
          />
        )}
        {currentStep < steps.length - 1 ? (
          <Button
            title="Next"
            onPress={() => setCurrentStep((p) => p + 1)}
            style={[styles.navButton, { flex: currentStep === 0 ? 1 : undefined }]}
          />
        ) : (
          <Button
            title="Save Draft"
            onPress={handleSubmit}
            loading={createMutation.isPending}
            icon={<Ionicons name="save-outline" size={18} color={Colors.textOnPrimary} />}
            style={styles.navButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotDone: {
    backgroundColor: Colors.success,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stepNumberActive: {
    color: Colors.textOnPrimary,
  },
  stepLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Form
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  navButton: {
    flex: 1,
  },
});
