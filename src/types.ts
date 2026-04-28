export interface Rep {
  id: string;
  name: string;
  email: string;
  startDate: string;
  territory?: string;
  managerId?: string;
  managerName?: string;
  currentMonth: number;
  createdAt: string;
  updatedAt: string;
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
  closedDeals: number;
  totalDealValue: number;
  meddpiccCompletionRate: number;
  activityScore: number;
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
