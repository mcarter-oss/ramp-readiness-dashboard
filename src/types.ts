export interface Rep {
  id: string;
  name: string;
  email: string;
  segment?: string;
  startDate: string;
  currentMonth: number;
  rampScore?: number;
  status?: 'red' | 'yellow' | 'green';
  pipelineCoverage?: number;
  certifications?: {
    meddpicc: boolean;
    demoCert: boolean;
    rolePlay: boolean;
  };
  deals?: Deal[];
  managerApproval?: boolean;
  territory?: string;
  managerId?: string;
  managerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  stage: string;
  amount: number;
  meddpiccScore: number;
  lastActivityDate: string;
}

export interface Milestone {
  id: string;
  month: number;
  name: string;
  description?: string;
  category: 'salesforce' | 'certification' | 'manager_approval';
  weight: number;
  targetValue?: number;
}

export interface RepMilestone {
  id: string;
  repId: string;
  milestoneId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  currentValue: number;
  targetValue?: number;
  completedAt?: string;
  notes?: string;
  milestone?: Milestone;
}

export interface SalesforceData {
  id: string;
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
  syncedAt: string;
}

export interface Certification {
  id: string;
  repId: string;
  name: string;
  badgeId?: string;
  earnedDate?: string;
  expiryDate?: string;
  status: 'not_started' | 'in_progress' | 'earned' | 'expired';
}

export interface ManagerInput {
  id: string;
  repId: string;
  inputType: 'checklist' | 'approval' | 'note';
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  value?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessScore {
  id: string;
  repId: string;
  month: number;
  overallScore: number;
  salesforceScore?: number;
  certificationScore?: number;
  managerScore?: number;
  status: 'red' | 'yellow' | 'green';
  alerts: string[];
  recommendedActions: string[];
  computedAt: string;
}

export interface DashboardSummary {
  rep: Rep;
  currentScore: ReadinessScore;
  milestoneProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  status: 'red' | 'yellow' | 'green';
  alerts: string[];
  recommendedActions: string[];
}

export type StatusColor = 'red' | 'yellow' | 'green';
