export async function seedData(db: D1Database) {
  // Seed milestones for Months 1-6 based on month-based expectations
  const milestones = [
    // Month 1 (Onboarding)
    { id: 'm1-1', month: 1, name: 'CRM setup complete', category: 'salesforce', weight: 3 },
    { id: 'm1-2', month: 1, name: 'Training completed', category: 'certification', weight: 3 },
    { id: 'm1-3', month: 1, name: 'First discovery call observed', category: 'manager_approval', weight: 2 },
    { id: 'm1-4', month: 1, name: 'First pitch delivered', category: 'manager_approval', weight: 2 },

    // Month 2 (Sales Essentials)
    { id: 'm2-1', month: 2, name: 'MEDDPICC certification complete', category: 'certification', weight: 3 },
    { id: 'm2-2', month: 2, name: 'Territory plan submitted', category: 'manager_approval', weight: 2 },
    { id: 'm2-3', month: 2, name: 'First forecast entered', category: 'salesforce', weight: 2 },
    { id: 'm2-4', month: 2, name: 'Solution pitch delivered', category: 'manager_approval', weight: 3 },

    // Month 3 (Pipeline Creation)
    { id: 'm3-1', month: 3, name: 'First deal registered', category: 'salesforce', weight: 3 },
    { id: 'm3-2', month: 3, name: 'Pipeline coverage ≥ 1.5x', category: 'salesforce', weight: 3, targetValue: 1.5 },
    { id: 'm3-3', month: 3, name: 'CRM hygiene score ≥ 80%', category: 'salesforce', weight: 2, targetValue: 80 },
    { id: 'm3-4', month: 3, name: 'MEDDPICC fields partially complete', category: 'salesforce', weight: 2 },

    // Month 4 (Execution)
    { id: 'm4-1', month: 4, name: 'Pipeline coverage ≥ 2-3x', category: 'salesforce', weight: 3, targetValue: 2.5 },
    { id: 'm4-2', month: 4, name: 'CRM hygiene ≥ 90-95%', category: 'salesforce', weight: 2, targetValue: 90 },
    { id: 'm4-3', month: 4, name: 'Demo certification complete', category: 'certification', weight: 3 },
    { id: 'm4-4', month: 4, name: 'Active deal progression', category: 'manager_approval', weight: 2 },

    // Month 5 (Closing Motion)
    { id: 'm5-1', month: 5, name: 'Multi-threading present', category: 'manager_approval', weight: 2 },
    { id: 'm5-2', month: 5, name: 'Executive alignment exists', category: 'manager_approval', weight: 3 },
    { id: 'm5-3', month: 5, name: 'Forecast accuracy improving', category: 'salesforce', weight: 2 },
    { id: 'm5-4', month: 5, name: 'At least 1 late-stage deal', category: 'salesforce', weight: 3 },

    // Month 6 (Fully Ramped Readiness)
    { id: 'm6-1', month: 6, name: 'First deal closed', category: 'salesforce', weight: 4 },
    { id: 'm6-2', month: 6, name: 'Forecast accuracy validated', category: 'salesforce', weight: 3 },
    { id: 'm6-3', month: 6, name: 'Pipeline ≥ 3-4x', category: 'salesforce', weight: 3, targetValue: 3.5 },
    { id: 'm6-4', month: 6, name: 'MEDDPICC complete on key deals', category: 'salesforce', weight: 3 },
    { id: 'm6-5', month: 6, name: 'Manager approval = TRUE', category: 'manager_approval', weight: 4 }
  ];

  for (const m of milestones) {
    await db.prepare(`
      INSERT OR IGNORE INTO milestones (id, month, name, category, weight, target_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(m.id, m.month, m.name, m.category, m.weight, m.targetValue || null).run();
  }

  return { milestonesSeeded: milestones.length };
}
