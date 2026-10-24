# Work order: cut ic3-manager down to the offline edition "ic3_collect_points" (Gemini, headless agy, mode write)

> Written by Claude 2026-10-25. Gemini does exactly this job inside the worktree it is started in.
> Claude reviews the result and does not trust Gemini's own report.

## 1. Goal
This repository was copied, uncut, from `ic3-manager` (a Flask + SQLAlchemy/SQLite backend and a React + TypeScript + Vite
frontend that manage a school computer lab). We are turning it into **ic3_collect_points**: a small OFFLINE edition that
one teacher runs on his own laptop, with no internet, no Google, no multi-user admin.

What the offline edition must keep (user flow):
1. `/choose-school` -> `/choose-class` -> `/dashboard` (the score table of the chosen class).
2. `/seating` (seating chart) and `/targets` (per-student target score). Both feed columns of the dashboard.
3. Receiving scores: `POST /api/save-score` (sent by student PCs), `/nhan_ip` (student PC registers its IP),
   serving `scripts/ThuDiem_Flash.ps1` at `/tools/ThuDiem_Flash.ps1`, and the Excel export of the score table.
4. The student-list tools that are reachable from the dashboard toolbar ("Danh sach HS", "Bat nhan diem", "Cong cu").

What must be REMOVED completely (code, routes, pages, CSS, API helpers, nav links, DB models that only they use):
- Google login/OAuth, registration, profile page, password reset, e-mail sending.
- Admin area (users/permissions, quizzes, questions, articles), teacher quiz assignment, student online quiz portal
  (`/portal`, `/level/*`, `/results/*`), Google scoreboard, Excel/GSheet import, "operation tools" page.
- Everything that talks to the internet (Google APIs, SMTP, CDN fonts/scripts if any are loaded at runtime).

Authentication is NOT your job. Claude will add a signed-licence login later. For now make the app run with a single
built-in local teacher: create ONE function `current_user()` in a new file `backend/src/auth_stub.py` that always returns a
teacher with every permission, and make every kept route/page use it. The frontend must not show a login page; `/` must
redirect to `/choose-school`. Keep all the permission *names* the kept pages already check, so Claude can plug the real
login in without touching the pages again.

Read first, in this order (only these):
1. `AGENTS.md` (project conventions)
2. `backend/app.py`, `backend/src/routes/api.py`, `backend/src/controllers/score_controller.py`
3. `frontend/src/App.tsx`, `frontend/src/pages/Dashboard.tsx` (only the parts that call the API)

## 2. Hard rules
You MUST:
- Change only these paths: `backend/**`, `frontend/src/**`, `scripts/**`, `run.bat`, `run_dev.bat`, `tests/**`.
- Keep the request/response shape of every route you keep (paths, JSON fields, form fields). The student-side scripts
  `scripts/lay_ip.bat` and `scripts/ThuDiem_Flash.ps1` and the compiled exams depend on them.
- Keep Vietnamese user-facing text as it is.
- After each big step run `python -m compileall -q backend/src backend/app.py`, and make it pass.
- Run `python .agent/check_ic3.py --base main --allow "backend/**" --allow "frontend/src/**" --allow "scripts/**" --allow "run.bat" --allow "run_dev.bat" --allow "tests/**"`
  and fix until it exits 0 (max 3 rounds).

You MUST NOT:
- Touch any other file (`tools/`, `.agent/`, `.claude/`, `dist/`, `frontend/package.json`, `frontend/package-lock.json`,
  `README.md`). Never read, create or edit `.env`, `*.db`, or anything under `storage/`.
- Run git commands, installs, builds, deploys, or any network request.
- Swallow exceptions (`except: pass`) or put secrets/keys in code.
- Leave dead imports, unused routes, unreachable pages or empty files behind. Delete them.
- Delete or rewrite `tests/test_save_score.py` logic; adapt it only if a removed model/import breaks it.

## 3. Brief
Steps, in this order:
1. Backend: delete the route modules for admin, quizzes (`quiz*.py`, `admin.py`), Excel/GSheet, operation tools and
   everything only they use (controllers, services, `utils/quiz_exporter.py`, e-mail helpers, Google OAuth in `auth.py`).
   Keep only what the kept routes import. Simplify `auth.py` so only an `/api/auth-status` style endpoint remains if the
   kept frontend still calls it, backed by `auth_stub.current_user()`.
2. Models: remove SQLAlchemy models and migrations/`schema_upgrade.py` entries used only by removed features. Keep the
   models for schools, classes, students/PCs, scores, targets, seating. The database file is created fresh on first run, so
   no data migration is needed, but `setup_database.py` and `app.py` must still create it correctly from the kept models.
3. `backend/requirements.txt`: remove packages only the removed code used (Google libs, SMTP/e-mail, etc.). Do not add any.
4. Frontend: delete the removed pages, components, hooks, CSS and API functions. Rewrite `App.tsx` to render only the kept
   routes plus the existing top navigation (Dashboard, Chon lop, Cho ngoi, Muc tieu, and the dashboard toolbar). No login,
   register, admin or profile links. `frontend/src/api/index.ts` keeps only the functions still used.
5. `run.bat` / `run_dev.bat`: remove steps for removed features (Google env, admin seeding). Keep the dist-based startup
   and the `IC3_DEV` logic.
6. `scripts/`: keep `lay_ip.bat`, `ThuDiem_Flash.ps1`, `fix_firewall.bat`, `set_ip.bat`, `ChuanBi_PhongThi.*`. Make sure
   `/tools/ThuDiem_Flash.ps1` is still served by the backend from `scripts/`.
7. Make `python -c "import app"` run from `backend/` (use whatever works without installing anything) and `python -m compileall` pass.
   Make `npx tsc -b` pass in `frontend/` if `node_modules` exists; if it does not, say so in your report.

Edge cases:
- A kept page may import a helper that lives in a removed file: move the helper into the kept file, do not keep the dead file.
- `/api/save-score` rate-limit and size limits (`rate_limit.py`, `score_controller.py`) must stay unchanged.
- `/nhan_ip` must keep working without any login.

Out of scope: the licence/login system, packaging, Nuitka, changing the look of any page, renaming routes.

## 4. Report back
Files deleted (count and the main ones), files changed, last line of the checker, what you could not do, assumptions.

## 5. Acceptance (Claude)
1. `run_agy.py` exit 0, no `stray_write`.
2. Claude runs the checker: exit 0; runs `python -m compileall` and `tsc`; runs `tests/test_save_score.py` (19 cases).
3. Claude reads the whole diff: nothing in kept routes lost, no leftover reference to removed modules (grep), no new network calls.
4. Claude starts the backend and calls `/api/save-score`, `/nhan_ip` and the dashboard data endpoint.
5. Add a row to `.agent/LEDGER.md`.
