export type WebhookStatus = 'unknown' | 'operational' | 'error' | 'warning';

export interface Webhook {
  id: string;
  name: string;
  url_masked: string;
  is_active: boolean;
  status: WebhookStatus;
  last_http_status: number | null;
  last_latency_ms: number | null;
  last_tested_at: string | null;
  created_at: string;
}

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedPayload {
  title: string;
  description: string;
  color: string;
  author: string;
  footer: string;
  image: string;
  thumbnail: string;
  fields: EmbedField[];
}

export interface Template {
  id: string;
  name: string;
  kind: 'message' | 'embed';
  payload: EmbedPayload | { content: string };
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface HistoryEntry {
  id: string;
  action: 'MESSAGE' | 'EMBED' | 'TEMPLATE';
  content: string;
  status: 'success' | 'error';
  detail: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  bot_name: string;
  avatar_url: string | null;
  hide_urls: boolean;
  updated_at: string;
}

export interface Stats {
  id: number;
  messages_sent: number;
  embeds_sent: number;
  errors: number;
  last_action: string | null;
  last_action_at: string | null;
  updated_at: string;
}

export type PageKey =
  | 'dashboard'
  | 'send'
  | 'embed'
  | 'tester'
  | 'manager'
  | 'templates'
  | 'history'
  | 'settings'
  | 'scheduled'
  | 'broadcast'
  | 'teams'
  | 'admin';

export type AdminPageKey =
  | 'admin-overview'
  | 'admin-users'
  | 'admin-user-details'
  | 'admin-webhooks'
  | 'admin-messages'
  | 'admin-templates'
  | 'admin-logs'
  | 'admin-security'
  | 'admin-settings';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Admin types
export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  is_banned: boolean;
  is_disabled: boolean;
  ban_reason: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface AdminUserDetails extends UserProfile {
  webhook_count: number;
  messages_sent: number;
  embeds_sent: number;
  errors: number;
}

export interface AdminWebhook {
  id: string;
  name: string;
  owner_email: string;
  owner_id: string;
  is_active: boolean;
  status: WebhookStatus;
  last_http_status: number | null;
  last_latency_ms: number | null;
  last_tested_at: string | null;
  created_at: string;
}

export interface AdminTemplate {
  id: string;
  name: string;
  kind: 'message' | 'embed';
  owner_email: string;
  owner_id: string | null;
  is_global: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface AdminHistoryEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  content: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_user_id: string | null;
  status: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface GlobalStats {
  total_users: number;
  total_webhooks: number;
  total_messages: number;
  total_embeds: number;
  total_errors: number;
  total_templates: number;
  banned_users: number;
  disabled_users: number;
}

export interface AdminSetting {
  key: string;
  value: string;
  category: string;
}

export interface ScheduledMessage {
  id: string;
  webhook_id: string;
  webhook_name: string;
  kind: 'message' | 'embed';
  payload: Record<string, unknown>;
  scheduled_for: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  last_run_at: string | null;
  created_at: string;
}

export interface BroadcastLog {
  id: string;
  content: string;
  kind: 'message' | 'embed';
  total: number;
  succeeded: number;
  failed: number;
  created_at: string;
}

export interface VariableInfo {
  key: string;
  description: string;
  example: string;
}

export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  member_count: number;
  webhook_count: number;
  created_at: string;
  role: TeamRole;
}

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: TeamRole;
  created_at: string;
}

export interface EmbedThemePreset {
  id: string;
  name: string;
  description: string;
  color: string;
  author: string;
  footer: string;
  thumbnail: string;
  fields: EmbedField[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeyCreated {
  id: string;
  key: string;
  name: string;
  key_prefix: string;
  created_at: string;
}
