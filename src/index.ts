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

// Dashboard UI
app.get('/', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ramp Readiness Dashboard</title>
  <style>
    * { margin:0; padding:0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #f5f7fa; padding: 20px; }
    .container { max-width: 1400px; margin:0 auto; }
    h1 { color: #1a1a1a; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .score { font-size: 48px; font-weight: bold; margin: 10px 0; }
    .status-red { color: #dc2626; }
    .status-yellow { color: #f59e0b; }
    .status-green { color: #10b981; }
    .rep-card { border-left: 4px solid #e5e7eb; cursor: pointer; }
    .rep-card.red { border-left-color: #dc2626; }
    .rep-card.yellow { border-left-color: #f59e0b; }
    .rep-card.green { border-left-color: #10b981; }
    .progress-bar { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: #3b82f6; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.red { background: #fee2e2; color: #dc2626; }
    .badge.yellow { background: #fef3c7; color: #f59e0b; }
    .badge.green { background: #d1fae5; color: #10b981; }
    button { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    select { padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; }
    .filters { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin: 8px 0; }
    .alert.medium { background: #fffbeb; border-color: #fde68a; }
    .alert.low { background: #f0f9ff; border-color: #bae6fd; }
    .section { margin: 30px 0; }
    .data-sources { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .source-card { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .source-card h3 { margin-bottom: 10px; color: #374151; }
    .leader-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: bold; color: #3b82f6; }
    .stat-label { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Ramp Readiness Dashboard</h1>
    <p class="subtitle">Track onboarding progression from Month 1 to Month 6</p>

    <div class="filters">
      <label>Manager: <select id="managerFilter"><option value="">All Managers</option></select></label>
      <label>Status: <select id="statusFilter">
        <option value="">All</option>
        <option value="red">Red</option>
        <option value="yellow">Yellow</option>
        <option value="green">Green</option>
      </select></label>
      <button onclick="loadDashboard()">Refresh</button>
    </div>

    <div id="leaderView"></div>
    <div id="teamOverview" class="dashboard-grid"></div>
    <div id="repDetails"></div>
    <div id="alertsContainer"></div>

    <div class="section">
      <h2>Data Sources</h2>
      <div class="data-sources">
        <div class="source-card">
          <h3>Salesforce (SFDC)</h3>
          <ul style="font-size: 13px; color: #4b5563;">
            <li>Opportunities</li>
            <li>Stage & Close Date</li>
            <li>Amount & MEDDPICC</li>
            <li>Activity (last touch)</li>
            <li>Pipeline coverage</li>
          </ul>
        </div>
        <div class="source-card">
          <h3>Enablement / LMS</h3>
          <ul style="font-size: 13px; color: #4b5563;">
            <li>Certification completion</li>
            <li>Badge status</li>
            <li>Training attendance</li>
          </ul>
        </div>
        <div class="source-card">
          <h3>Managers</h3>
          <ul style="font-size: 13px; color: #4b5563;">
            <li>Approval flags (true/false)</li>
            <li>Checklist completion</li>
            <li>Coaching session logged</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API = window.location.origin + '/api';
    let currentRepId = null;

    async function loadDashboard() {
      const params = new URLSearchParams();
      const mgr = document.getElementById('managerFilter').value;
      if (mgr) params.append('managerId', mgr);

      const [team, alerts] = await Promise.all([
        fetch(API + '/dashboard/team?' + params).then(r => r.json()),
        fetch(API + '/alerts?' + params).then(r => r.json())
      ]);

      renderLeaderView(team);
      renderTeam(team);
      renderAlerts(alerts);

      if (team.length > 0 && !currentRepId) {
        currentRepId = team[0].rep.id;
        loadRep(currentRepId);
      }
    }

    function renderLeaderView(data) {
      const onTrack = data.filter(d => d.status === 'green').length;
      const avgScore = data.length > 0 ? Math.round(data.reduce((sum, d) => sum + (d.currentScore?.overall_score || 0), 0) / data.length) : 0;

      document.getElementById('leaderView').innerHTML = '<div class="leader-stats">' +
        '<div class="stat-card"><div class="stat-value">' + Math.round((onTrack/data.length) * 100) + '%</div><div class="stat-label">% Reps On Track</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + avgScore + '%</div><div class="stat-label">Avg Ramp Score</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + data.length + '</div><div class="stat-label">Total Reps</div></div>' +
        '</div>';
    }

    function renderTeam(data) {
      const filter = document.getElementById('statusFilter').value;
      const filtered = filter ? data.filter((d: any) => d.status === filter) : data;

      document.getElementById('teamOverview').innerHTML = filtered.map((e: any) => {
        const rep = e.rep;
        const statusClass = e.status;
        const certs = rep.certifications || {};
        return '<div class="card rep-card ' + statusClass + '" onclick="loadRep(\\'' + rep.id + '\\')">' +
          '<h2>' + rep.name + '</h2>' +
          '<div class="score status-' + statusClass + '">' + (rep.ramp_score || 0) + '%</div>' +
          '<div class="badge ' + statusClass + '">' + e.status.toUpperCase() + '</div>' +
          '<p style="margin:10px 0;font-size:13px;">' + (rep.segment || 'Commercial') + ' • Month ' + rep.current_month + '</p>' +
          '<p style="font-size:12px;color:#666;">Pipeline: ' + (rep.pipeline_coverage || 0) + 'x | MedDPICC: ' + (certs.meddpicc ? '✓' : '✗') + '</p>' +
          '</div>';
      }).join('');
    }

    async function loadRep(id) {
      currentRepId = id;
      const d = await fetch(API + '/dashboard/rep/' + id).then(r => r.json());

      const certs = d.certifications || {};
      const dealsList = (d.deals || []).map((deal: any) =>
        '<li style="margin:5px 0;">' + deal.stage + ' - $' + deal.amount + ' (MEDDPICC: ' + deal.meddpicc_score + '%)</li>'
      ).join('');

      document.getElementById('repDetails').innerHTML = '<div class="card">' +
        '<h2>' + d.name + ' - Month ' + d.current_month + ' (' + (d.segment || 'Commercial') + ')</h2>' +
        '<div class="score status-' + d.status + '">' + (d.ramp_score || 0) + '%</div>' +
        '<div class="badge ' + d.status + '">' + d.status.toUpperCase() + '</div>' +
        '<div style="margin:20px 0;"><h3>Rep Details (Simple Structure Model)</h3>' +
        '<p><strong>Pipeline Coverage:</strong> ' + (d.pipeline_coverage || 0) + 'x</p>' +
        '<p><strong>Certifications:</strong> MEDDPICC: ' + (certs.meddpicc ? '✓' : '✗') +
        ' | Demo Cert: ' + (certs.demoCert ? '✓' : '✗') +
        ' | Role Play: ' + (certs.rolePlay ? '✓' : '✗') + '</p>' +
        '<p><strong>Manager Approval:</strong> ' + (d.manager_approval ? '✓ TRUE' : '✗ FALSE') + '</p>' +
        '</div>' +
        (d.deals && d.deals.length > 0 ? '<div style="margin-top:20px;"><h3>Deals</h3><ul>' + dealsList + '</ul></div>' : '') +
        '</div>';
    }

    function renderAlerts(alerts) {
      const c = document.getElementById('alertsContainer');
      if (alerts.length === 0) { c.innerHTML = '<p style="color:#666;">No alerts.</p>'; return; }
      c.innerHTML = '<h2>Alerts</h2>' + alerts.map(a => '<div class="alert ' + a.severity + '"><strong>' + a.repName + '</strong>: ' + a.message + '<br><em style="color:#666;">Action: ' + a.recommendedAction + '</em></div>').join('');
    }

    (async () => {
      const reps = await fetch(API + '/reps').then(r => r.json());
      const mgrs = [...new Set(reps.map(r => r.manager_id).filter(Boolean))];
      const sel = document.getElementById('managerFilter');
      mgrs.forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        o.text = reps.find(r => r.manager_id === m)?.manager_name || m;
        sel.add(o);
      });
      loadDashboard();
    })();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
});
      loadDashboard();
    })();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
});

// Rep management
app.post('/api/reps', async (c) => {
  const db = c.env.DB;
  const rep = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO reps (id, name, email, start_date, territory, manager_id, manager_name) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, rep.name, rep.email, rep.startDate, rep.territory, rep.managerId, rep.managerName).run();
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
  if (managerId) { query += ' WHERE manager_id = ?'; params.push(managerId); }
  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results || []);
});

// Milestones
app.post('/api/milestones', async (c) => {
  const db = c.env.DB;
  const m = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO milestones (id, month, name, description, category, weight, target_value) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, m.month, m.name, m.description, m.category, m.weight, m.targetValue).run();
  return c.json({ id, ...m }, 201);
});

app.get('/api/milestones', async (c) => {
  const db = c.env.DB;
  const month = c.req.query('month');
  let query = 'SELECT * FROM milestones';
  const params: any[] = [];
  if (month) { query += ' WHERE month = ?'; params.push(parseInt(month)); }
  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results || []);
});

// Rep milestones
app.post('/api/reps/:repId/milestones', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');
  const { milestoneId, status, currentValue, notes } = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO rep_milestones (id, rep_id, milestone_id, status, current_value, notes) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(rep_id, milestone_id) DO UPDATE SET status=excluded.status, current_value=excluded.current_value, notes=excluded.notes`)
    .bind(id, repId, milestoneId, status, currentValue || 0, notes).run();
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
  await db.prepare(`INSERT INTO certifications (id, rep_id, name, badge_id, earned_date, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, repId, cert.name, cert.badgeId, cert.earnedDate, cert.expiryDate, cert.status).run();
  return c.json({ id, ...cert }, 201);
});

// Manager inputs
app.post('/api/reps/:repId/manager-inputs', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');
  const input = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO manager_inputs (id, rep_id, input_type, title, status, value, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, repId, input.inputType, input.title, input.status, input.value, input.notes, input.createdBy).run();
  return c.json({ id, ...input }, 201);
});

// Dashboard summary with Simple Structure Model
app.get('/api/dashboard/rep/:repId', async (c) => {
  const db = c.env.DB;
  const repId = c.req.param('repId');

  const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(repId).first() as any;
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

  // Build Simple Structure Model response
  const latestSFData = salesforceData.find((d: any) => d.month === rep.current_month);
  const deals = latestSFData?.raw_data ? JSON.parse(latestSFData.raw_data).deals || [] : [];

  const repResponse = {
    name: rep.name,
    segment: rep.segment || 'Commercial',
    start_date: rep.start_date,
    current_month: rep.current_month,
    ramp_score: score.overallScore,
    status: score.status,
    pipeline_coverage: latestSFData?.pipeline_coverage || 0,
    certifications: {
      meddpicc: certifications.results?.some((c: any) => c.name.includes('MEDDPICC') && c.status === 'earned') || false,
      demo_cert: certifications.results?.some((c: any) => c.name.includes('Demo') && c.status === 'earned') || false,
      role_play: certifications.results?.some((c: any) => c.name.includes('Role Play') && c.status === 'earned') || false
    },
    deals: deals,
    manager_approval: managerInputs.results?.some((i: any) => i.input_type === 'approval' && i.status === 'approved') || false
  };

  return c.json(repResponse);
});
});

// Team dashboard with Simple Structure Model
app.get('/api/dashboard/team', async (c) => {
  const db = c.env.DB;
  const managerId = c.req.query('managerId');

  let query = 'SELECT * FROM reps';
  const params: any[] = [];
  if (managerId) { query += ' WHERE manager_id = ?'; params.push(managerId); }

  const repsResult = await db.prepare(query).bind(...params).all();
  const reps = repsResult.results || [];

  const summaries = [];
  for (const rep of reps) {
    const repData = rep as any;

    // Get latest readiness score
    const scoreResult = await db.prepare(`
      SELECT * FROM readiness_scores WHERE rep_id = ? ORDER BY computed_at DESC LIMIT 1
    `).bind(repData.id).first();

    // Get latest Salesforce data
    const sfData = await db.prepare(`
      SELECT * FROM salesforce_data WHERE rep_id = ? ORDER BY month DESC LIMIT 1
    `).bind(repData.id).first() as any;

    // Get certifications
    const certs = await db.prepare('SELECT * FROM certifications WHERE rep_id = ?').bind(repData.id).all() as any;

    // Get manager inputs
    const managerInputs = await db.prepare('SELECT * FROM manager_inputs WHERE rep_id = ?').bind(repData.id).all() as any;

    // Build Simple Structure Model for each rep
    const deals = sfData?.raw_data ? JSON.parse(sfData.raw_data).deals || [] : [];

    summaries.push({
      rep: {
        name: repData.name,
        segment: repData.segment || 'Commercial',
        start_date: repData.start_date,
        current_month: repData.current_month,
        ramp_score: (scoreResult as any)?.overall_score || 0,
        status: (scoreResult as any)?.status || 'red',
        pipeline_coverage: sfData?.pipeline_coverage || 0,
        certifications: {
          meddpicc: certs.results?.some((c: any) => c.name.includes('MEDDPICC') && c.status === 'earned') || false,
          demoCert: certs.results?.some((c: any) => c.name.includes('Demo') && c.status === 'earned') || false,
          rolePlay: certs.results?.some((c: any) => c.name.includes('Role Play') && c.status === 'earned') || false
        },
        deals: deals,
        manager_approval: managerInputs.results?.some((i: any) => i.input_type === 'approval' && i.status === 'approved') || false
      },
      currentScore: scoreResult || null,
      status: (scoreResult as any)?.status || 'red'
    });
  }

  return c.json(summaries);
});

// Alerts
app.get('/api/alerts', async (c) => {
  const db = c.env.DB;
  const managerId = c.req.query('managerId');
  const alerts = await generateAlerts(db, managerId);
  return c.json(alerts);
});

export default {
  fetch: app.fetch.bind(app),
  async scheduled(controller: any, env: Bindings, ctx: ExecutionContext) {
    const db = env.DB;
    const reps = await db.prepare('SELECT * FROM reps').all();
    for (const rep of (reps.results || []) as any[]) {
      const milestones = await db.prepare(`SELECT rm.*, m.month, m.name, m.category, m.weight, m.target_value FROM rep_milestones rm JOIN milestones m ON rm.milestone_id = m.id WHERE rm.rep_id = ?`).bind(rep.id).all() as any;
      const salesforceData = await getSalesforceData(db, rep.id);
      const certifications = await db.prepare('SELECT * FROM certifications WHERE rep_id = ?').bind(rep.id).all() as any;
      const managerInputs = await db.prepare('SELECT * FROM manager_inputs WHERE rep_id = ?').bind(rep.id).all() as any;
      const score = calculateReadinessScore(rep, milestones.results || [], salesforceData, certifications.results || [], managerInputs.results || []);
      await db.prepare(`INSERT INTO readiness_scores (id, rep_id, month, overall_score, salesforce_score, certification_score, manager_score, status, alerts, recommended_actions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(score.id, score.repId, score.month, score.overallScore, score.salesforceScore, score.certificationScore, score.managerScore, score.status, JSON.stringify(score.alerts), JSON.stringify(score.recommendedActions)).run();
    }
  }
};
