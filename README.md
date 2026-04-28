# Ramp Readiness Dashboard

A Cloudflare Workers-based dashboard for Sales Account Executives that tracks onboarding progression from Month 1 to Month 6.

## Features

- **Readiness Scoring**: Computes 0-100% scores based on Salesforce data, certifications, and manager inputs
- **Red/Yellow/Green Status**: Visual indicators for each rep's ramp progress
- **Milestone Tracking**: 24 milestones across 6 months (Salesforce, certification, manager approval)
- **Salesforce Integration**: Ingests pipeline, deal activity, and MEDDPICC fields
- **Certification Tracking**: Monitors badges and certifications with expiry dates
- **Manager Inputs**: Checklists, approvals, and notes from managers
- **Alert System**: Automatically generates alerts for missed milestones
- **Recommended Actions**: Provides actionable recommendations for AEs and managers

## Tech Stack

- **Cloudflare Workers** with Hono framework
- **Cloudflare D1** (SQLite) for data storage
- **Cloudflare KV** for caching
- **TypeScript** for type safety

## API Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/` | GET | Dashboard UI |
| `/api/reps` | GET, POST | List/create sales reps |
| `/api/reps/:id` | GET | Get rep details |
| `/api/reps/:id/salesforce` | POST | Ingest Salesforce data |
| `/api/reps/:id/certifications` | POST | Add certification |
| `/api/reps/:id/manager-inputs` | POST | Add manager input |
| `/api/dashboard/rep/:id` | GET | Individual rep dashboard |
| `/api/dashboard/team` | GET | Team overview |
| `/api/alerts` | GET | System alerts |
| `/health` | GET | Health check |

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create D1 database:
   ```bash
   npx wrangler d1 create ramp-readiness-db
   ```

3. Apply migrations:
   ```bash
   npx wrangler d1 migrations apply ramp-readiness-db --local
   ```

4. Run locally:
   ```bash
   npm run dev
   ```

5. Deploy:
   ```bash
   npm run deploy
   ```

## Environment Variables

Set these secrets using `wrangler secret put`:

- `SALESFORCE_CLIENT_ID` - Salesforce OAuth client ID
- `SALESFORCE_CLIENT_SECRET` - Salesforce OAuth client secret
- `SALESFORCE_REFRESH_TOKEN` - Salesforce refresh token

## Project Structure

```
src/
├── index.ts          # Main Worker with API routes
├── types.ts          # TypeScript type definitions
├── salesforce.ts     # Salesforce data ingestion
├── scoring.ts        # Readiness scoring algorithm
├── alerts.ts         # Alert generation system
├── seed.ts           # Sample data seeder
└── dashboard.html    # Dashboard UI
migrations/
└── 0001_initial_schema.sql  # Database schema
```

## License

ISC
