import { request } from './client';
import type { ReportsSummary } from '../types';

export interface ReportsSummaryResponse {
  summary: ReportsSummary;
}

/**
 * Fetch authoritative summary reports calculated across all accessible products (owned + shared).
 */
export async function getReportsSummary(): Promise<ReportsSummary> {
  const data = await request<ReportsSummaryResponse>('/api/reports/summary');
  return data.summary;
}
