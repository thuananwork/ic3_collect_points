# Work order: <ten viec> (Gemini, headless agy, mode write)

> Viet boi Claude <ngay>. Gemini chi lam dung viec nay trong worktree `<duong dan worktree>`.
> Claude nghiem thu, khong tin bao cao cua Gemini.

## 1. Goal
<Mot doan: tinh nang/sua loi gi, ai dung, vi sao.>

Read first, in this order (only these):
1. `AGENTS.md` (quy uoc du an)
2. `<file code lien quan>`
3. `<file mau de bat chuoc phong cach>`

## 2. Hard rules
You MUST:
- Change only these paths: `<allowed paths>`.
- Follow the existing style of the files you read (naming, error handling, Vietnamese user-facing text).
- Run `python .agent/check_ic3.py --base <base-branch> <cac --allow>` and fix until it exits 0 (max 3 rounds).

You MUST NOT:
- Touch any other file. Never read, create or edit `.env`, `*.db`, or anything under `portable/`.
- Run git commands, installs, builds, deploys, or any network request.
- Swallow exceptions (`except: pass`) or put secrets/keys in code.
- Change the public API shape (routes, JSON fields) unless the brief says so.

## 3. Brief
- Behavior wanted: <bullet>
- Files expected to change: <list>
- Edge cases: <list>
- Out of scope: <list>

## 4. Report back
Files changed, last line of the checker, what you could not do, any assumption you made.

## 5. Acceptance (Claude)
1. `run_agy.py` exit 0, no `stray_write`.
2. Claude runs the checker, exit 0.
3. Claude reads the whole diff: logic, auth/permission checks, SQL, error paths, race conditions.
4. Backend: import the app and run the affected endpoint; frontend: build.
5. Add a row to `.agent/LEDGER.md`.
