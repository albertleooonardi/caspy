import { API_URL, request } from './game';
export type Account = { id: string; name: string; email: string; role: 'contributor' | 'researcher'; org_id: string | null; org_name: string | null; avatar_url?: string | null; avatar_token?: string | null; avatar_contract?: string | null; avatar_chain?: number | null };
export type Campaign = { id: string; name: string; description: string; organization?: string; active?: number; config: { actor_requested?: string; judge_requested?: string; [key: string]: unknown } };
export type Dataset = { id: string; title: string; description: string; organization: string; license: string; price_cents: number; currency: string; sample_count: number; access: 'owner' | 'none' | 'requested' | 'granted' | 'rejected' };
export const platformRequest = <T,>(path: string, body?: unknown) => request<T>(path, body, API_URL || '/api');
export const percent = (value: number | null) => value === null ? 'Not enough labels' : `${(value * 100).toFixed(1)}%`;
