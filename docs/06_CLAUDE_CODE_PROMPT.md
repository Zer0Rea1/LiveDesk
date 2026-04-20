# Claude Code Prompt — Build the SRT Live Reporter System

Use this file with Claude Code to scaffold and build the entire project.

---

## Master Prompt (paste this into Claude Code)

```
You are building a news channel live streaming system called "SRT Live Reporter".

The system allows a news channel admin to generate one-time URLs with custom quality settings,
send them to journalists, who open the link in a browser, give camera access, and stream
live video directly to the channel's existing SRT server via: Browser → WebSocket → FFmpeg → SRT.

There is NO Mediamtx and NO relay server. FFmpeg on the VPS pushes directly to the
existing SRT server configured in the environment variables SRT_SERVER_HOST and SRT_SERVER_PORT.

Read ALL documentation files in the /docs folder before writing any code:
- 00_PROJECT_OVERVIEW.md — architecture, folder structure, design decisions
- 01_BACKEND_API.md — complete Node.js backend: Express API, WebSocket→FFmpeg→SRT bridge
- 02_ADMIN_FRONTEND.md — React admin dashboard with token management
- 03_REPORTER_FRONTEND.md — standalone HTML reporter page (no build step)
- 04_INFRASTRUCTURE.md — Docker Compose, Nginx config, Dockerfiles
- 05_DEPLOYMENT.md — deployment steps and troubleshooting

Build in this exact order:

PHASE 1 — SCAFFOLD
1. Create folder structure as defined in 00_PROJECT_OVERVIEW.md
2. Initialize backend/package.json with all dependencies from 01_BACKEND_API.md
3. Initialize frontend-admin/ using: npm create vite@latest . -- --template react-ts
   Then install: axios react-router-dom @tanstack/react-query date-fns
4. Create backend/.env.example exactly as shown in 01_BACKEND_API.md
5. Create infra/.env with placeholder values for all variables

PHASE 2 — DATABASE
6. Create backend/src/prisma/schema.prisma exactly as in 01_BACKEND_API.md
7. Run: cd backend && npx prisma generate
8. Confirm prisma client generated without errors

PHASE 3 — BACKEND (build in this file order)
9.  backend/tsconfig.json
10. backend/src/index.ts
11. backend/src/routes/auth.ts
12. backend/src/routes/tokens.ts
13. backend/src/middleware/adminAuth.ts
14. backend/src/lib/tokenService.ts
15. backend/src/ws/srtBridge.ts
16. Run: cd backend && npx tsc --noEmit
17. Fix ALL TypeScript errors before continuing. Build must be clean.

PHASE 4 — ADMIN FRONTEND (build in this file order)
18. frontend-admin/vite.config.ts
19. frontend-admin/src/api/client.ts
20. frontend-admin/src/App.tsx
21. frontend-admin/src/pages/LoginPage.tsx
22. frontend-admin/src/pages/Dashboard.tsx
23. frontend-admin/src/pages/GenerateToken.tsx
24. frontend-admin/src/components/Layout.tsx
25. Run: cd frontend-admin && npm run build
26. Fix all errors. Build must succeed.

PHASE 5 — REPORTER PAGE
27. Create frontend-reporter/index.html exactly as in 03_REPORTER_FRONTEND.md
28. The file must be completely standalone — no npm, no build, no external dependencies
29. Set WS_URL = 'wss://yourdomain.com/stream' with a comment:
    // IMPORTANT: Change this to your VPS domain before deployment

PHASE 6 — INFRASTRUCTURE
30. infra/docker-compose.yml — from 04_INFRASTRUCTURE.md, NO Mediamtx service
31. infra/nginx.conf — include WebSocket upgrade headers on /stream location
32. backend/Dockerfile — must install FFmpeg inside the container
33. frontend-admin/Dockerfile — multi-stage build, nginx serves built React app

PHASE 7 — FINAL VERIFICATION
34. Check every import in backend TypeScript resolves correctly
35. Verify API route paths in frontend-admin/src/api/client.ts match routes in backend/src/routes/
36. Verify the SRT URL in srtBridge.ts uses SRT_SERVER_HOST and SRT_SERVER_PORT from env
37. Verify there is NO reference to Mediamtx anywhere in the codebase
38. Verify there is NO reference to localhost:9998 as a hardcoded SRT target
39. Create a root README.md with:
    - 3-sentence description of the system
    - Prerequisites (Node 20, FFmpeg with SRT, PostgreSQL)
    - Quick start commands
    - How to test FFmpeg → SRT server manually

CRITICAL RULES:
- Follow every code sample in the docs EXACTLY — do not simplify or skip logic
- The SRT target is always process.env.SRT_SERVER_HOST + SRT_SERVER_PORT — never hardcoded
- No Mediamtx anywhere — not in docker-compose, not in code, not in comments
- All TypeScript must compile cleanly with strict mode
- The reporter HTML must work when opened directly with ?token=... in the URL
- FFmpeg must be installed in the backend Docker container (not assumed to exist)
- After each phase confirm what was built before moving to the next
```

---

## Phase-by-Phase Prompts

Use these if you prefer to build one phase at a time.

### Phase 1 — Scaffold
```
Create the complete folder structure for the SRT Live Reporter project
as defined in 00_PROJECT_OVERVIEW.md. Initialize all package.json files.
Create .env.example with all variables from 01_BACKEND_API.md.
Do not write any application logic yet.
```

### Phase 2 — Database
```
Create backend/src/prisma/schema.prisma using the exact schema in 01_BACKEND_API.md.
Run prisma generate and show me the output. Fix any errors.
```

### Phase 3 — Backend
```
Build the complete Node.js backend from 01_BACKEND_API.md.
Create files in this order: tsconfig.json, index.ts, auth.ts, tokens.ts,
adminAuth.ts, tokenService.ts, srtBridge.ts.

Key requirement: in srtBridge.ts the SRT URL must use:
  process.env.SRT_SERVER_HOST and process.env.SRT_SERVER_PORT
Never hardcode an SRT host. Never reference Mediamtx.

After all files are created run: npx tsc --noEmit
Fix all TypeScript errors before finishing this phase.
```

### Phase 4 — Admin Frontend
```
Build the React admin frontend from 02_ADMIN_FRONTEND.md.
Create: vite.config.ts, client.ts, App.tsx, LoginPage.tsx,
Dashboard.tsx, GenerateToken.tsx, Layout.tsx.
Run: npm run build — fix all errors before finishing.
```

### Phase 5 — Reporter Page
```
Create frontend-reporter/index.html from 03_REPORTER_FRONTEND.md.
This must be a 100% standalone HTML file. No build step, no npm.
Set const WS_URL = 'wss://yourdomain.com/stream' and add a comment
above it saying it must be updated before deployment.
```

### Phase 6 — Infrastructure
```
Create all infrastructure files from 04_INFRASTRUCTURE.md:
- infra/docker-compose.yml (no Mediamtx service)
- infra/nginx.conf (WebSocket upgrade on /stream)
- backend/Dockerfile (must install FFmpeg)
- frontend-admin/Dockerfile (multi-stage, serves with nginx)
```
