# Marketing Automation Platform

## Quick Start

1. Clone the repository
2. Create `.env` files in both backend and frontend directories
3. Run with Docker Compose:

```bash
docker-compose up -d
```

## Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **n8n**: http://localhost:5678 (admin/admin123)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Development

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

## Architecture

- **Frontend**: Next.js 14 with TypeScript, TailwindCSS, NextAuth
- **Backend**: FastAPI with SQLAlchemy, JWT auth, Redis for queuing
- **Automation**: n8n for workflow automation
- **Database**: PostgreSQL
- **Cache/Queue**: Redis