import { D1Database } from '@cloudflare/workers-types';

interface Alert {
  repId: string;
  repName: string;
  type: 'milestone_missed' | 'low_pipeline' | 'certification_overdue' | 'manager_approval_pending' | 'low_readiness_score';
  severity: 'high' | 'medium' | 'low';
  message: string;
  recommendedAction: string;
  createdAt: string;
}

export async function generateAlerts(db: D1Database, managerId?: string): Promise<Alert[]> {
  const alerts: Alert[] = [];

  let repQuery = 'SELECT * FROM reps';
  const params: any[] = [];
  if (managerId) {
    repQuery += ' WHERE manager_id = ?';
    params.push(managerId);
  }

  const repsResult = await db.prepare(repQuery).bind(...params).all();
  const reps = repsResult.results || [];

  for (const rep of reps) {
    const repData = rep as any;

    const scoreResult = await db.prepare(`
      SELECT * FROM readiness_scores WHERE rep_id = ? ORDER BY computed_at DESC LIMIT 1
    `).bind(repData.id).first();

    if (scoreResult && (scoreResult as any).overall_score < 60) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'low_readiness_score',
        severity: 'high',
        message: `Readiness score is ${(scoreResult as any).overall_score}%, below target of 60%`,
        recommendedAction: 'Schedule immediate 1:1 to review blockers and create action plan',
        createdAt: new Date().toISOString()
      });
    }

    const missedMilestones = await db.prepare(`
      SELECT rm.*, m.name as milestone_name FROM rep_milestones rm
      JOIN milestones m ON rm.milestone_id = m.id
      WHERE rm.rep_id = ? AND rm.status = 'missed'
    `).bind(repData.id).all();

    for (const milestone of (missedMilestones.results || []) as any[]) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'milestone_missed',
        severity: 'medium',
        message: `Milestone "${milestone.milestone_name}" was missed`,
        recommendedAction: 'Review why milestone was missed and reschedule with support',
        createdAt: new Date().toISOString()
      });
    }

    const pendingApprovals = await db.prepare(`
      SELECT * FROM manager_inputs WHERE rep_id = ? AND status = 'pending'
    `).bind(repData.id).all();

    if ((pendingApprovals.results || []).length > 0) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'manager_approval_pending',
        severity: 'low',
        message: `${(pendingApprovals.results || []).length} manager approvals pending`,
        recommendedAction: 'Follow up with manager to complete pending reviews',
        createdAt: new Date().toISOString()
      });
    }

    const currentMonthData = await db.prepare(`
      SELECT * FROM salesforce_data WHERE rep_id = ? AND month = ?
    `).bind(repData.id, repData.current_month).first();

    if (currentMonthData) {
      const data = currentMonthData as any;
      const pipelineTargets: Record<number, number> = { 1: 0, 2: 50000, 3: 150000, 4: 300000, 5: 500000, 6: 750000 };
      const target = pipelineTargets[repData.current_month] || 750000;

      if (data.pipeline_value < target * 0.5) {
        alerts.push({
          repId: repData.id,
          repName: repData.name,
          type: 'low_pipeline',
          severity: 'high',
          message: `Pipeline ($${data.pipeline_value}) is below 50% of target ($${target})`,
          recommendedAction: 'Focus on outbound prospecting and lead generation activities',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return alerts;
}
