import type { Rep, RepMilestone, SalesforceData, Certification, ManagerInput, ReadinessScore } from './types';

export function calculateReadinessScore(
  rep: Rep,
  milestones: RepMilestone[],
  salesforceData: SalesforceData[],
  certifications: Certification[],
  managerInputs: ManagerInput[]
): ReadinessScore {
  const currentMonth = rep.currentMonth;

  const alerts: string[] = [];
  const recommendedActions: string[] = [];

  const certificationScore = calculateCertificationScore(certifications, currentMonth, alerts, recommendedActions);
  const pipelineScore = calculatePipelineScore(rep, salesforceData, currentMonth, alerts, recommendedActions);
  const dealQualityScore = calculateDealQualityScore(rep, salesforceData, currentMonth, alerts, recommendedActions);
  const activityScore = calculateActivityScore(rep, salesforceData, currentMonth, alerts, recommendedActions);
  const managerValidationScore = calculateManagerValidationScore(managerInputs, currentMonth, alerts, recommendedActions);

  // Weighted: Certifications 20%, Pipeline 25%, Deal Quality 25%, Activity 15%, Manager 15%
  const overallScore = (certificationScore * 0.20 + pipelineScore * 0.25 + dealQualityScore * 0.25 + activityScore * 0.15 + managerValidationScore * 0.15);

  let status: 'red' | 'yellow' | 'green';
  if (overallScore >= 80) {
    status = 'green';
  } else if (overallScore >= 60) {
    status = 'yellow';
  } else {
    status = 'red';
  }

  return {
    id: crypto.randomUUID(),
    repId: rep.id,
    month: currentMonth,
    overallScore: Math.round(overallScore * 10) / 10,
    salesforceScore: Math.round((pipelineScore * 0.625 + dealQualityScore * 0.625 + activityScore * 0.75) * 10) / 10,
    certificationScore,
    managerScore: managerValidationScore,
    status,
    alerts,
    recommendedActions,
    computedAt: new Date().toISOString()
  };
}

function calculatePipelineScore(
  rep: Rep,
  salesforceData: SalesforceData[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  const monthData = salesforceData.find(d => d.month === month);
  if (!monthData) {
    alerts.push(`No Salesforce data synced for Month ${month}`);
    recommendedActions.push('Sync Salesforce data for current month');
    return 0;
  }

  const pipelineTargets: Record<number, number> = { 1: 0, 2: 50000, 3: 150000, 4: 300000, 5: 500000, 6: 750000 };
  const pipelineTarget = pipelineTargets[month] || 750000;
  const pipelineScore = Math.min(100, (monthData.pipelineValue / pipelineTarget) * 100);

  if (monthData.pipelineValue < pipelineTarget * 0.5) {
    alerts.push(`Pipeline value ($${monthData.pipelineValue}) is below 50% of target ($${pipelineTarget})`);
    recommendedActions.push('Focus on prospecting and building pipeline');
  }

  return Math.round(pipelineScore * 10) / 10;
}

function calculateDealQualityScore(
  rep: Rep,
  salesforceData: SalesforceData[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  const monthData = salesforceData.find(d => d.month === month);
  if (!monthData) return 0;

  const meddpiccScore = monthData.meddpiccCompletionRate || 0;

  if (meddpiccScore < 60) {
    alerts.push('MEDDPICC completion rate is below 60%');
    recommendedActions.push('Complete MEDDPICC training and apply to active deals');
  }

  return Math.round(meddpiccScore * 10) / 10;
}

function calculateActivityScore(
  rep: Rep,
  salesforceData: SalesforceData[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  const monthData = salesforceData.find(d => d.month === month);
  if (!monthData) return 0;

  return Math.round((monthData.activityScore || 0) * 10) / 10;
}

function calculateManagerValidationScore(
  managerInputs: ManagerInput[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  if (managerInputs.length === 0) {
    alerts.push('No manager inputs recorded');
    recommendedActions.push('Schedule 1:1 with manager for progress review');
    return 0;
  }

  const approved = managerInputs.filter(i => i.status === 'approved').length;
  const score = (approved / managerInputs.length) * 100;

  const pending = managerInputs.filter(i => i.status === 'pending');
  if (pending.length > 0) {
    alerts.push(`${pending.length} manager approvals still pending`);
    recommendedActions.push('Follow up with manager on pending approvals');
  }

  return Math.round(score * 10) / 10;
}

  let score = 0;

  const pipelineTargets: Record<number, number> = { 1: 0, 2: 50000, 3: 150000, 4: 300000, 5: 500000, 6: 750000 };
  const pipelineTarget = pipelineTargets[month] || 750000;
  const pipelineScore = Math.min(100, (monthData.pipelineValue / pipelineTarget) * 100);
  score += pipelineScore * 0.3;

  const dealTargets: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 5, 5: 7, 6: 10 };
  const dealTarget = dealTargets[month] || 10;
  const dealScore = Math.min(100, (monthData.closedDeals / dealTarget) * 100);
  score += dealScore * 0.3;

  score += monthData.meddpiccCompletionRate * 0.2;
  score += monthData.activityScore * 0.2;

  if (monthData.pipeline_value < pipelineTarget * 0.5) {
    alerts.push(`Pipeline value ($${monthData.pipelineValue}) is below 50% of target ($${pipelineTarget})`);
    recommendedActions.push('Focus on prospecting and building pipeline');
  }

  if (monthData.meddpicc_completion_rate < 60) {
    alerts.push('MEDDPICC completion rate is below 60%');
    recommendedActions.push('Complete MEDDPICC training and apply to active deals');
  }

  return Math.round(score * 10) / 10;
}

function calculateCertificationScore(
  certifications: Certification[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  if (certifications.length === 0) {
    alerts.push('No certifications tracked');
    recommendedActions.push('Enroll in product certification courses');
    return 0;
  }

  const requiredCerts: Record<number, string[]> = {
    1: ['Product Fundamentals'],
    2: ['Product Fundamentals', 'Sales Methodology'],
    3: ['Product Fundamentals', 'Sales Methodology', 'MEDDPICC Mastery'],
    4: ['Product Fundamentals', 'Sales Methodology', 'MEDDPICC Mastery', 'Negotiation Skills'],
    5: ['Product Fundamentals', 'Sales Methodology', 'MEDDPICC Mastery', 'Negotiation Skills', 'Industry Solutions'],
    6: ['Product Fundamentals', 'Sales Methodology', 'MEDDPICC Mastery', 'Negotiation Skills', 'Industry Solutions', 'Advanced Demo']
  };

  const required = requiredCerts[month] || requiredCerts[6];
  const earned = certifications.filter(c => c.status === 'earned').map(c => c.name);
  const completed = required.filter(req => earned.includes(req)).length;
  const score = (completed / required.length) * 100;

  if (completed < required.length) {
    const missing = required.filter(req => !earned.includes(req));
    alerts.push(`Missing certifications: ${missing.join(', ')}`);
    recommendedActions.push(`Complete missing certifications: ${missing.join(', ')}`);
  }

  return Math.round(score * 10) / 10;
}

function calculateManagerScore(
  managerInputs: ManagerInput[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  if (managerInputs.length === 0) {
    alerts.push('No manager inputs recorded');
    recommendedActions.push('Schedule 1:1 with manager for progress review');
    return 0;
  }

  const approved = managerInputs.filter(i => i.status === 'approved').length;
  const score = (approved / managerInputs.length) * 100;

  const pending = managerInputs.filter(i => i.status === 'pending');
  if (pending.length > 0) {
    alerts.push(`${pending.length} manager approvals still pending`);
    recommendedActions.push('Follow up with manager on pending approvals');
  }

  return Math.round(score * 10) / 10;
}

function calculateMilestoneScore(
  milestones: RepMilestone[],
  month: number,
  alerts: string[],
  recommendedActions: string[]
): number {
  const monthMilestones = milestones.filter(m => {
    const milestoneMonth = m.milestone?.month || 1;
    return milestoneMonth <= month;
  });

  if (monthMilestones.length === 0) {
    return 0;
  }

  const completed = monthMilestones.filter(m => m.status === 'completed').length;
  const score = (completed / monthMilestones.length) * 100;

  const missed = monthMilestones.filter(m => m.status === 'missed');
  if (missed.length > 0) {
    alerts.push(`${missed.length} milestones have been missed`);
    recommendedActions.push('Review and reschedule missed milestones');
  }

  return Math.round(score * 10) / 10;
}
