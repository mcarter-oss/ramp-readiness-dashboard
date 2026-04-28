import { D1Database } from '@cloudflare/workers-types';
import type { Deal } from './types';

export interface SalesforcePayload {
  repId: string;
  month: number;
  pipelineValue: number;
  pipelineCoverage?: number;
  closedDeals: number;
  totalDealValue: number;
  meddpiccCompletionRate: number;
  activityScore: number;
  deals?: Deal[];
  rawData?: any;
}

export function calculateMeddpiccCompletionRate(meddpiccFields?: SalesforcePayload['meddpiccFields']): number {
  if (!meddpiccFields) return 0;
  const fields = Object.values(meddpiccFields);
  const completed = fields.filter(v => v === true).length;
  return (completed / fields.length) * 100;
}

export function calculateMeddpiccCompletionRate(meddpiccFields?: SalesforcePayload['meddpiccFields']): number {
  if (!meddpiccFields) return 0;
  const fields = Object.values(meddpiccFields);
  const completed = fields.filter(v => v === true).length;
  return (completed / fields.length) * 100;
}

export function calculateActivityScore(activityMetrics?: SalesforcePayload['activityMetrics']): number {
  if (!activityMetrics) return 0;
  const { callsLogged, emailsSent, meetingsHeld, demosCompleted } = activityMetrics;
  return Math.min(100, (callsLogged * 0.2 + emailsSent * 0.1 + meetingsHeld * 2 + demosCompleted * 5));
}

export async function upsertSalesforceData(db: D1Database, payload: SalesforcePayload): Promise<void> {
  const meddpiccCompletionRate = calculateMeddpiccCompletionRate(payload.meddpiccFields);
  const activityScore = calculateActivityScore(payload.activityMetrics);
  const rawData = JSON.stringify({
    meddpiccFields: payload.meddpiccFields,
    activityMetrics: payload.activityMetrics,
    deals: payload.deals
  });

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO salesforce_data (id, rep_id, month, pipeline_value, pipeline_coverage, closed_deals, total_deal_value, meddpicc_completion_rate, activity_score, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(rep_id, month) DO UPDATE SET
      pipeline_value = excluded.pipeline_value,
      pipeline_coverage = excluded.pipeline_coverage,
      closed_deals = excluded.closed_deals,
      total_deal_value = excluded.total_deal_value,
      meddpicc_completion_rate = excluded.meddpicc_completion_rate,
      activity_score = excluded.activity_score,
      raw_data = excluded.raw_data,
      synced_at = datetime('now')
  `).bind(
    id, payload.repId, payload.month, payload.pipelineValue,
    payload.pipelineCoverage || null, payload.closedDeals,
    payload.totalDealValue, meddpiccCompletionRate, activityScore, rawData
  ).run();
}

export async function getSalesforceData(db: D1Database, repId: string, month?: number): Promise<any[]> {
  let query = 'SELECT * FROM salesforce_data WHERE rep_id = ?';
  const params: any[] = [repId];

  if (month !== undefined) {
    query += ' AND month = ?';
    params.push(month);
  }

  query += ' ORDER BY month DESC';
  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}
