import { supabase, EDGE_URL } from './supabase';
import type { EmbedPayload, VariableInfo } from './types';

interface ApiResult {
  ok: boolean;
  status: number;
  message?: string;
  error?: string;
  [k: string]: unknown;
}

async function callApi(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const res = await fetch(`${EDGE_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: token,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return { ...data, status: res.status, ok: data.ok ?? res.ok };
}

export async function sendMessage(opts: {
  webhookId?: string;
  content: string;
  username?: string;
  avatarUrl?: string;
  variables?: Record<string, string>;
}): Promise<ApiResult> {
  return callApi('send-message', {
    webhook_id: opts.webhookId,
    content: opts.content,
    username: opts.username,
    avatar_url: opts.avatarUrl,
    variables: opts.variables,
  });
}

export async function sendEmbed(opts: {
  webhookId?: string;
  embed: EmbedPayload;
  username?: string;
  avatarUrl?: string;
  variables?: Record<string, string>;
}): Promise<ApiResult> {
  return callApi('send-embed', {
    webhook_id: opts.webhookId,
    embed: opts.embed,
    username: opts.username,
    avatar_url: opts.avatarUrl,
    variables: opts.variables,
  });
}

export async function sendTemplate(opts: {
  webhookId?: string;
  template: { name: string; kind: string; payload: Record<string, unknown> };
  username?: string;
  avatarUrl?: string;
  variables?: Record<string, string>;
}): Promise<ApiResult> {
  return callApi('send-template', {
    webhook_id: opts.webhookId,
    template: opts.template,
    username: opts.username,
    avatar_url: opts.avatarUrl,
    variables: opts.variables,
  });
}

export async function broadcastMessage(opts: {
  webhookIds: string[];
  kind: 'message' | 'embed';
  content?: string;
  embed?: EmbedPayload;
  username?: string;
  avatarUrl?: string;
  variables?: Record<string, string>;
}): Promise<ApiResult & { total?: number; succeeded?: number; failed?: number; results?: Record<string, unknown> }> {
  return callApi('broadcast', {
    webhook_ids: opts.webhookIds,
    kind: opts.kind,
    content: opts.content,
    embed: opts.embed,
    username: opts.username,
    avatar_url: opts.avatarUrl,
    variables: opts.variables,
  });
}

export async function testWebhook(opts: {
  webhookId?: string;
}): Promise<ApiResult & { reachable?: boolean; latency_ms?: number }> {
  return callApi('test-webhook', { webhook_id: opts.webhookId });
}

export async function processScheduled(): Promise<ApiResult & { processed?: number; succeeded?: number; failed?: number }> {
  return callApi('process-scheduled', {});
}

export const AVAILABLE_VARIABLES: VariableInfo[] = [
  { key: 'date', description: 'Current date (local)', example: '{{date}}' },
  { key: 'time', description: 'Current time (local)', example: '{{time}}' },
  { key: 'datetime', description: 'Full date and time', example: '{{datetime}}' },
  { key: 'timestamp', description: 'Unix timestamp', example: '{{timestamp}}' },
  { key: 'year', description: 'Current year', example: '{{year}}' },
  { key: 'month', description: 'Month number (01-12)', example: '{{month}}' },
  { key: 'day', description: 'Day of month (01-31)', example: '{{day}}' },
  { key: 'hour', description: 'Hour (00-23)', example: '{{hour}}' },
  { key: 'minute', description: 'Minute (00-59)', example: '{{minute}}' },
  { key: 'weekday', description: 'Day of week name', example: '{{weekday}}' },
  { key: 'month_name', description: 'Month name', example: '{{month_name}}' },
  { key: 'iso_date', description: 'ISO date (YYYY-MM-DD)', example: '{{iso_date}}' },
  { key: 'iso_time', description: 'ISO time (HH:MM:SS)', example: '{{iso_time}}' },
  { key: 'week_number', description: 'Week of year', example: '{{week_number}}' },
  { key: 'greeting', description: 'Time-based greeting', example: '{{greeting}}' },
  { key: 'random_number', description: 'Random number 0-9999', example: '{{random_number}}' },
  { key: 'random_uuid', description: 'Random UUID', example: '{{random_uuid}}' },
  { key: 'server_name', description: 'Custom: Discord server name', example: '{{server_name}}' },
  { key: 'user_count', description: 'Custom: Member count', example: '{{user_count}}' },
  { key: 'channel_name', description: 'Custom: Channel name', example: '{{channel_name}}' },
];
