import { Hono } from 'hono';
import { Rep, Milestone, RepMilestone, Certification, ManagerInput, ReadinessScore, DashboardSummary } from './types';
import { upsertSalesforceData, getSalesforceData } from './salesforce';
import { calculateReadinessScore } from './scoring';
import { generateAlerts } from './alerts';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

type Bindings = {
  RAMP_DATA: KVNamespace;
  DB: D1Database;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve dashboard UI
app.get('/', async (c) => {
  const html = await fetch(new URL('./dashboard.html', import.meta.url)).then(r => r.text()).catch(() => 'Dashboard not found');
  return c.html(html);
});

// Rep management
app.post('/api/reps', async (c) => {
  const db = c.env.DB;
  const rep = await c.req.json();

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO reps (id, name, email, start_date, territory, manager_id, manager_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, rep.name, rep.email, rep.startDate, rep.territory, rep.managerId, rep.managerName).run();

  return c.json({ id, ...rep }, 201);
});

app.get('/api/reps/:id', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('id');
  const result = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(repId).first();
  return result ? c.json(result) : c.json({ error: 'Rep not found' }, 404);
});

app.get('/api/reps', async (c) => {
  const db = c.env.DB;
  const managerId = c.req.query('managerId');
  let query = 'SELECT * FROM reps';
  const params: any[] = [];
  if (managerId) {
    query += ' WHERE manager_id = ?';
    params.push(managerId);
  }
  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results || []);
});

// Milestones
app.post('/api/milestones', async (c) => {
  const db = c.env.DB;
  const milestone = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO milestones (id, month, name, description, category, weight, target_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, milestone.month, milestone.name, milestone.description, milestone.category, milestone.weight, milestone.targetValue).run();
  return c.json({ id, ...milestone }, 201);
});

app.get('/api/milestones', async (c) => {
  const db = c.env.DB;
  const month = c.req.query('month');
  let query = 'SELECT * FROM milestones';
  const params: any[] = [];
  if (month) {
    query += ' WHERE month = ?';
    params.push(parseInt(month));
  }
  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results || []);
});

// Rep milestones
app.post('/api/reps/:repId/milestones', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');
  const { milestoneId, status, currentValue, notes } = await c.req.json();

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO rep_milestones (id, rep_id, milestone_id, status, current_value, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(rep_id, milestone_id) DO UPDATE SET
      status = excluded.status,
      current_value = excluded.current_value,
      notes = excluded.notes,
      completed_at = CASE WHEN excluded.status = 'completed' THEN datetime('now') ELSE completed_at END
  `).bind(id, repId, milestoneId, status, currentValue || 0, notes).run();

  return c.json({ id, repId, milestoneId, status, currentValue, notes }, 201);
});

// Salesforce data
app.post('/api/reps/:repId/salesforce', async (c) => {
  const repId = c.req.param('repId');
  const payload = await c.req.json();
  await upsertSalesforceData(c.env.DB, { ...payload, repId });
  return c.json({ success: true });
});

// Certifications
app.post('/api/reps/:repId/certifications', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');
  const cert = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO certifications (id, rep_id, name, badge_id, earned_date, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, repId, cert.name, cert.badgeId, cert.earnedDate, cert.expiryDate, cert.status).run();
  return c.json({ id, ...cert }, 201);
});

// Manager inputs
app.post('/api/reps/:repId/manager-inputs', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');
  const input = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO manager_inputs (id, rep_id, input_type, title, status, value, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, repId, input.inputType, input.title, input.status, input.value, input.notes, input.createdBy).run();
  return c.json({ id, ...input }, 201);
});

// Dashboard summary
app.get('/api/dashboard/rep/:repId', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');

  const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(repId).first() as Rep | null;
  if (!rep) return c.json({ error: 'Rep not found' }, 404);

  const milestones = await db.prepare(`
    SELECT rm.*, m.month, m.name, m.category, m.weight, m.target_value
    FROM rep_milestones rm
    JOIN milestones m ON rm.milestone_id = m.id
    WHERE rm.rep_id = ?
  `).bind(repId).all() as any;

  const salesforceData = await getSalesforceData(db, repId);
  const certifications = await db.prepare('SELECT * FROM certifications WHERE rep_id = ?').bind(repId).all() as any;
  const managerInputs = await db.prepare('SELECT * FROM manager_inputs WHERE rep_id = ?').bind(repId).all() as any;

  const score = calculateReadinessScore(
    rep,
    milestones.results || [],
    salesforceData,
    certifications.results || [],
    managerInputs.results || []
  );

  await db.prepare(`
    INSERT INTO readiness_scores (id, rep_id, month, overall_score, salesforce_score, certification_score, manager_score, status, alerts, recommended_actions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    score.id, score.repId, score.month, score.overallScore, score.salesforceScore,
    score.certificationScore, score.managerScore, score.status,
    JSON.stringify(score.alerts), JSON.stringify(score.recommendedActions)
  ).run();

  const completedMilestones = (milestones.results || []).filter((m: any) => m.status === 'completed').length;
  const totalMilestones = (milestones.results || []).filter((m: any) => (m.month || 1) <= rep.currentMonth).length;

  const summary: DashboardSummary = {
    rep,
    currentScore: score,
    milestoneProgress: {
      completed: completedMilestones,
      total: totalMilestones,
      percentage: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0
    },
    status: score.status,
    alerts: score.alerts,
    recommendedActions: score.recommendedActions
  };

  return c.json(summary);
});

// Team dashboard
app.get('/api/dashboard/team', async (c) => {
  const db = c.env.DB;
  const managerId = c.req.query('managerId');

  let query = 'SELECT * FROM reps';
  const params: any[] = [];
  if (managerId) {
    query += ' WHERE manager_id = ?';
    params.push(managerId);
  }

  const repsResult = await db.prepare(query).bind(...params).all();
  const reps = repsResult.results || [];

  const summaries = [];
  for (const rep of reps) {
    const scoreResult = await db.prepare(`
      SELECT * FROM readiness_scores
      WHERE rep_id = ? ORDER BY computed_at DESC LIMIT 1
    `).bind((rep as any).id).first();

    summaries.push({
      rep,
      currentScore: scoreResult || null,
      status: (scoreResult as any)?.status || 'red'
    });
  }

  return c.json(summaries);
});

// Alerts endpoint
app.get('/api/alerts', async (c) => {
  const db = c.env.DB;
  const managerId = c.req.query('managerId');
  const alerts = await generateAlerts(db, managerId);
  return c.json(alerts);
});

// Cloudflare Workers fetch handler
export default {
  fetch: app.fetch.bind(app),
  async scheduled(controller: any, env: Bindings, ctx: ExecutionContext) {
    // Scheduled task to recompute readiness scores daily
    const db = env.DB;
    const reps = await db.prepare('SELECT * FROM reps').all();
    for (const rep of (reps.results || []) as any[]) {
      const milestones = await db.prepare(`
        SELECT rm.*, m.month, m.name, m.category, m.weight, m.target_value
        FROM rep_milestones rm
        JOIN milestones m ON rm.milestone_id = m.id
        WHERE rm.rep_id = ?
      `).bind(rep.id).all() as any;

      const { getSalesforceData } = await import('./salesforce');
      const salesforceData = await getSalesforceData(db, rep.id);
      const certifications = await db.prepare('SELECT * FROM certifications WHERE rep_id = ?').bind(rep.id).all() as any;
      const managerInputs = await db.prepare('SELECT * FROM manager_inputs WHERE rep_id = ?').bind(rep.id).all() as any;

      const { calculateReadinessScore } = await import('./scoring');
      const score = calculateReadinessScore(
        rep as any,
        milestones.results || [],
        salesforceData,
        certifications.results || [],
        managerInputs.results || []
      );

      await db.prepare(`
        INSERT INTO readiness_scores (id, rep_id, month, overall_score, salesforce_score, certification_score, manager_score, status, alerts, recommended_actions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        score.id, score.repId, score.month, score.overallScore, score.salesforceScore,
        score.certificationScore, score.managerScore, score.status,
        JSON.stringify(score.alerts), JSON.stringify(score.recommendedActions)
      ).run();
    }
  }
};
