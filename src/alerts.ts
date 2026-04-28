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
    const currentMonth = repData.current_month;

    // Get rep's data
    const [scoreResult, milestonesResult, salesforceResult, certsResult, managerInputsResult] = await Promise.all([
      db.prepare(`SELECT * FROM readiness_scores WHERE rep_id = ? ORDER BY computed_at DESC LIMIT 1`).bind(repData.id).first(),
      db.prepare(`SELECT rm.*, m.month, m.name FROM rep_milestones rm JOIN milestones m ON rm.milestone_id = m.id WHERE rm.rep_id = ?`).bind(repData.id).all(),
      db.prepare(`SELECT * FROM salesforce_data WHERE rep_id = ? ORDER BY month DESC LIMIT 1`).bind(repData.id).all(),
      db.prepare(`SELECT * FROM certifications WHERE rep_id = ?`).bind(repData.id).all(),
      db.prepare(`SELECT * FROM manager_inputs WHERE rep_id = ?`).bind(repData.id).all()
    ]);

    const monthData = (salesforceResult as any).results?.[0];
    const milestones = (milestonesResult as any).results || [];
    const certifications = (certsResult as any).results || [];
    const managerInputs = (managerInputsResult as any).results || [];

    // Alert: Rep is below expected milestone for their month
    const monthMilestones = milestones.filter((m: any) => m.month === currentMonth);
    const missingMilestones = monthMilestones.filter((m: any) => m.status !== 'completed');
    if (missingMilestones.length >= 2) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'milestone_missed',
        severity: 'high',
        message: `Month ${currentMonth}: ${missingMilestones.length} milestones behind schedule`,
        recommendedAction: `Focus on completing: ${missingMilestones.map((m: any) => m.name).join(', ')}`,
        createdAt: new Date().toISOString()
      });
    }

    // Alert: Pipeline coverage below threshold
    if (monthData && monthData.pipeline_value < 100000) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'low_pipeline',
        severity: 'high',
        message: `Pipeline coverage below threshold: $${monthData.pipeline_value}`,
        recommendedAction: 'Low pipeline → focus on prospecting + ICP alignment',
        createdAt: new Date().toISOString()
      });
    }

    // Alert: No deal registered by Month 3
    if (currentMonth >= 3 && monthData && monthData.closed_deals === 0) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'no_deals_month_3',
        severity: 'high',
        message: `No deal registered by Month ${currentMonth}`,
        recommendedAction: 'No deal registered by Month 3 → focus on pipeline creation and booking 5 new meetings this week',
        createdAt: new Date().toISOString()
      });
    }

    // Alert: No MEDDPICC progress by Month 3-4
    if (currentMonth >= 3 && currentMonth <= 4 && monthData && monthData.meddpicc_completion_rate < 50) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'low_meddpicc',
        severity: 'medium',
        message: `No MEDDPICC progress by Month ${currentMonth} (${monthData.meddpicc_completion_rate}%)`,
        recommendedAction: 'Weak MEDDPICC → run Deal Inspector',
        createdAt: new Date().toISOString()
      });
    }

    // Alert: No late-stage deal by Month 5
    if (currentMonth >= 5 && monthData && monthData.closed_deals === 0) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'no_late_stage_deal',
        severity: 'high',
        message: `No late-stage deal by Month ${currentMonth}`,
        recommendedAction: 'No late-stage deal by Month 5 → review deal progression with manager',
        createdAt: new Date().toISOString()
      });
    }

    // Alert: Manager has not completed approvals
    const pendingApprovals = managerInputs.filter((i: any) => i.status === 'pending');
    if (pendingApprovals.length > 0) {
      alerts.push({
        repId: repData.id,
        repName: repData.name,
        type: 'manager_approval_pending',
        severity: 'low',
        message: `${pendingApprovals.length} manager approvals pending`,
        recommendedAction: 'Follow up with manager on pending approvals',
        createdAt: new Date().toISOString()
      });
    }

    // Alert: Low readiness score
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
  }

  return alerts;
}
