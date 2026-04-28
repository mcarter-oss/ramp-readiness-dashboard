export async function seedData(db: D1Database) {
  // Seed milestones for Months 1-6
  const milestones = [
    // Month 1
    { id: 'm1-1', month: 1, name: 'Complete Salesforce CRM Training', category: 'salesforce', weight: 2 },
    { id: 'm1-2', month: 1, name: 'Product Fundamentals Certification', category: 'certification', weight: 2 },
    { id: 'm1-3', month: 1, name: 'Shadow 3 Customer Calls', category: 'manager_approval', weight: 1 },
    { id: 'm1-4', month: 1, name: 'Complete MEDDPICC Training', category: 'certification', weight: 1 },

    // Month 2
    { id: 'm2-1', month: 2, name: 'Build Pipeline: $50K', category: 'salesforce', weight: 2, targetValue: 50000 },
    { id: 'm2-2', month: 2, name: 'Close First Deal', category: 'salesforce', weight: 2 },
    { id: 'm2-3', month: 2, name: 'Sales Methodology Certification', category: 'certification', weight: 2 },
    { id: 'm2-4', month: 2, name: 'Manager: Pass Product Demo', category: 'manager_approval', weight: 1 },

    // Month 3
    { id: 'm3-1', month: 3, name: 'Pipeline: $150K', category: 'salesforce', weight: 2, targetValue: 150000 },
    { id: 'm3-2', month: 3, name: 'Close 3 Deals', category: 'salesforce', weight: 2, targetValue: 3 },
    { id: 'm3-3', month: 3, name: 'MEDDPICC Mastery Certification', category: 'certification', weight: 2 },
    { id: 'm3-4', month: 3, name: 'Complete 5 Discovery Calls', category: 'manager_approval', weight: 1 },

    // Month 4
    { id: 'm4-1', month: 4, name: 'Pipeline: $300K', category: 'salesforce', weight: 2, targetValue: 300000 },
    { id: 'm4-2', month: 4, name: 'Close 5 Deals Total', category: 'salesforce', weight: 2, targetValue: 5 },
    { id: 'm4-3', month: 4, name: 'Negotiation Skills Certification', category: 'certification', weight: 1 },
    { id: 'm4-4', month: 4, name: 'Manager: Mid-Review Approval', category: 'manager_approval', weight: 1 },

    // Month 5
    { id: 'm5-1', month: 5, name: 'Pipeline: $500K', category: 'salesforce', weight: 2, targetValue: 500000 },
    { id: 'm5-2', month: 5, name: 'Close 7 Deals Total', category: 'salesforce', weight: 2, targetValue: 7 },
    { id: 'm5-3', month: 5, name: 'Industry Solutions Certification', category: 'certification', weight: 1 },
    { id: 'm5-4', month: 5, name: 'Lead 3 Full Sales Cycles', category: 'manager_approval', weight: 1 },

    // Month 6
    { id: 'm6-1', month: 6, name: 'Pipeline: $750K', category: 'salesforce', weight: 2, targetValue: 750000 },
    { id: 'm6-2', month: 6, name: 'Close 10 Deals Total', category: 'salesforce', weight: 2, targetValue: 10 },
    { id: 'm6-3', month: 6, name: 'Advanced Demo Certification', category: 'certification', weight: 1 },
    { id: 'm6-4', month: 6, name: 'Manager: Final Ramp Approval', category: 'manager_approval', weight: 2 }
  ];

  for (const m of milestones) {
    await db.prepare(`
      INSERT OR IGNORE INTO milestones (id, month, name, category, weight, target_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(m.id, m.month, m.name, m.category, m.weight, m.targetValue || null).run();
  }

  return { milestonesSeeded: milestones.length };
}
