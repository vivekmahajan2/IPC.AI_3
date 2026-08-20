// TypeScript types for IPC.ai

export type UserRole = 'police' | 'superior' | 'student' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  verified: boolean;
  phone?: string;
  badge_number?: string;
  station?: string;
  created_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export type FIRStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'finalized';

export interface IncidentDetails {
  complainant_name?: string;
  complainant_father_name?: string;
  complainant_address?: string;
  complainant_phone?: string;
  incident_date?: string;
  incident_time?: string;
  incident_place?: string;
  district?: string;
  accused_name?: string;
  accused_description?: string;
  description?: string;
  witness_details?: string;
  property_stolen?: string;
  property_value?: string;
}

export interface FIRDraft {
  id: number;
  client_uuid: string;
  user_id: number;
  title: string;
  fir_number?: string;
  incident_details: IncidentDetails;
  sections_applied: string[];
  status: FIRStatus;
  reviewer_id?: number;
  review_comments?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SectionMapping {
  id: number;
  old_act: string;
  old_section: string;
  old_title?: string;
  old_text?: string;
  new_act: string;
  new_section: string;
  new_title?: string;
  new_text?: string;
  mapping_notes?: string;
  is_identical: boolean;
}

export interface Judgment {
  id: number;
  case_title: string;
  court_name: string;
  bench?: string;
  judgment_date?: string;
  citation?: string;
  case_number?: string;
  summary?: string;
  full_text_url?: string;
}

export interface Lawyer {
  id: number;
  bar_council_id?: string;
  name: string;
  firm_name?: string;
  specialization: string[];
  practicing_courts: string[];
  years_of_exp?: number;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  languages: string[];
  is_verified: boolean;
}

export interface SearchHistoryItem {
  id: number;
  module: string;
  query: string;
  response_summary?: string;
  created_at: string;
}

export interface LegalQueryResponse {
  answer: string;
  sources: SourceReference[];
  query: string;
}

export interface SourceReference {
  act?: string;
  section?: string;
  title?: string;
  text_snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  timestamp: Date;
}
