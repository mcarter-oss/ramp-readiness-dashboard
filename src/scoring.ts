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

  // Apply month-based milestone status logic
  const monthStatus = calculateMonthStatus(milestones, currentMonth);

  // Check "Fully Ramped" logic for Month 6
  const isFullyRamped = currentMonth >= 6 && checkFullyRamped(rep, milestones, salesforceData, certifications, managerInputs);

  let status: 'red' | 'yellow' | 'green';
  if (isFullyRamped) {
    status = 'green';
  } else if (monthStatus === 'green' && overallScore >= 80) {
    status = 'green';
  } else if (monthStatus === 'red' || overallScore < 60) {
    status = 'red';
  } else {
    status = 'yellow';
  }

  // Generate intelligent recommended actions
  const intelligentActions = generateRecommendedActions(rep, salesforceData, certifications, managerInputs, currentMonth);
  const allActions = [...recommendedActions, ...intelligentActions];

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
    recommendedActions: allActions,
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

function checkFullyRamped(
  rep: Rep,
  milestones: RepMilestone[],
  salesforceData: SalesforceData[],
  certifications: Certification[],
  managerInputs: ManagerInput[]
): boolean {
  const month6Data = salesforceData.find(d => d.month === 6);

  // A rep is fully ramped when:
  // - Ramp score ≥ 85
  // - First deal closed
  // - Pipeline coverage ≥ 3x
  // - MEDDPICC complete on at least 1 deal
  // - Forecast accuracy validated
  // - Manager approval = TRUE

  const firstDealClosed = month6Data ? month6Data.closedDeals >= 1 : false;
  const pipelineCoverage = month6Data ? month6Data.pipelineValue >= 750000 * 3 : false;
  const meddpiccComplete = month6Data ? month6Data.meddpiccCompletionRate >= 80 : false;
  const managerApproved = managerInputs.some(i => i.inputType === 'approval' && i.status === 'approved');

  return firstDealClosed && pipelineCoverage && meddpiccComplete && managerApproved;
}

function generateRecommendedActions(
  rep: Rep,
  salesforceData: SalesforceData[],
  certifications: Certification[],
  managerInputs: ManagerInput[],
  currentMonth: number
): string[] {
  const actions: string[] = [];
  const monthData = salesforceData.find(d => d.month === currentMonth);

  // Low pipeline
  if (monthData && monthData.pipelineValue < 100000) {
    actions.push('Low pipeline → focus on prospecting + ICP alignment');
  }

  // Weak MEDDPICC
  if (monthData && monthData.meddpiccCompletionRate < 60) {
    actions.push('Weak MEDDPICC → run Deal Inspector');
  }

  // No exec alignment
  if (currentMonth >= 5 && monthData && monthData.meddpiccCompletionRate < 80) {
    actions.push('No exec alignment → identify EB + schedule exec call');
  }

  // No deal by Month 3
  if (currentMonth >= 3 && monthData && monthData.closedDeals === 0) {
    actions.push('No deal registered by Month 3 → focus on pipeline creation and booking 5 new meetings this week');
  }

  // No late-stage deal by Month 5
  if (currentMonth >= 5 && monthData && monthData.closedDeals === 0) {
    actions.push('No late-stage deal by Month 5 → review deal progression with manager');
  }

  // Missing certifications
  const earned = certifications.filter(c => c.status === 'earned').length;
  if (earned < 2 && currentMonth >= 2) {
    actions.push('Complete required certifications for your current month');
  }

  // Manager approvals pending
  const pendingApprovals = managerInputs.filter(i => i.status === 'pending').length;
  if (pendingApprovals > 0) {
    actions.push('Follow up with manager on pending approvals');
  }

  return actions;
}

function calculateMonthStatus(
  milestones: RepMilestone[],
  month: number
): 'red' | 'yellow' | 'green' {
  const monthMilestones = milestones.filter(m => {
    const milestoneMonth = m.milestone?.month || 1;
    return milestoneMonth === month;
  });

  if (monthMilestones.length === 0) return 'red';

  const completed = monthMilestones.filter(m => m.status === 'completed').length;
  const missing = monthMilestones.length - completed;

  // Status Logic: Green = all complete, Yellow = 1 missing, Red = 2+ missing
  if (missing === 0) return 'green';
  if (missing === 1) return 'yellow';
  return 'red';
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
