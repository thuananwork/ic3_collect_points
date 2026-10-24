"""Bo kiem cho viec Gemini viet code trong ic3-manager. Chay trong worktree cua Gemini.

    python .agent/check_ic3.py --base main --allow "backend/src/**" --allow "tests/**"

Ma thoat 0 sach, 1 co loi, 2 sai cach dung. Chi kiem HINH DANG (pham vi file, bien dich, bi mat, kiem
kieu); khong thay duoc loi logic. Claude van phai doc diff (xem .agent/README.md).
"""
import argparse, fnmatch, json, os, re, shutil, subprocess, sys

SECRET_PATTERNS = [
    (r"AIza[0-9A-Za-z_\-]{30,}", "GOOGLE_API_KEY"),
    (r"(?i)(secret|password|passwd|token|api_key)\s*[=:]\s*['\"][^'\"\s]{8,}['\"]", "HARDCODED_SECRET"),
    (r"ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}", "GITHUB_TOKEN"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "PRIVATE_KEY"),
]
ALWAYS_FORBIDDEN = [".env", "backend/ic3manager.db"]


def sh(args, cwd):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def changed_files(cwd, base):
    out = sh(["git", "diff", "--name-only", f"{base}...HEAD"], cwd).stdout.split()
    out += sh(["git", "diff", "--name-only"], cwd).stdout.split()
    out += sh(["git", "ls-files", "--others", "--exclude-standard"], cwd).stdout.split()
    return sorted(set(out))


def added_lines(cwd, base):
    d = sh(["git", "diff", "-U0", base], cwd).stdout
    cur, res = None, []
    for line in d.splitlines():
        if line.startswith("+++ b/"):
            cur = line[6:]
        elif line.startswith("+") and not line.startswith("+++") and cur:
            res.append((cur, line[1:]))
    for f in sh(["git", "ls-files", "--others", "--exclude-standard"], cwd).stdout.split():
        p = os.path.join(cwd, f)
        try:
            for l in open(p, encoding="utf-8").read().splitlines():
                res.append((f, l))
        except (OSError, UnicodeDecodeError):
            pass
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="main")
    ap.add_argument("--allow", action="append", default=[])
    ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    cwd = os.path.abspath(a.repo)
    if not a.allow:
        print(json.dumps({"event": "usage", "error": "can it nhat mot --allow"}))
        return 2
    errors = []
    files = changed_files(cwd, a.base)
    if not files:
        errors.append(("NO_CHANGES", "khong co file nao thay doi"))
    for f in files:
        if f in ALWAYS_FORBIDDEN or f.endswith(".db") or f.startswith(".git/"):
            errors.append(("FORBIDDEN_FILE", f))
        elif not any(fnmatch.fnmatch(f, g) for g in a.allow):
            errors.append(("OUT_OF_SCOPE", f))
        elif f.endswith(".py") and os.path.isfile(os.path.join(cwd, f)):
            try:
                with open(os.path.join(cwd, f), encoding="utf-8") as fh:
                    compile(fh.read(), f, "exec")
            except SyntaxError as e:
                errors.append(("PY_SYNTAX", f"{f}:{e.lineno}: {e.msg}"))
    added = added_lines(cwd, a.base)
    for i, (f, line) in enumerate(added):
        for rx, code in SECRET_PATTERNS:
            if re.search(rx, line):
                errors.append((code, f))
        if f.endswith(".py"):
            nxt = added[i + 1][1] if i + 1 < len(added) and added[i + 1][0] == f else ""
            if re.match(r"\s*except\b[^:]*:\s*pass\s*$", line) or (
                    re.match(r"\s*except\b[^:]*:\s*$", line) and re.match(r"\s*pass\s*$", nxt)):
                errors.append(("SWALLOWED_EXCEPTION", f))
    ts = [f for f in files if f.startswith("frontend/") and f.endswith((".ts", ".tsx"))]
    fe = os.path.join(cwd, "frontend")
    if ts and shutil.which("npx") and os.path.isdir(os.path.join(fe, "node_modules")):
        r = sh(["npx", "tsc", "--noEmit"], fe)
        if r.returncode != 0:
            errors.append(("TSC_FAILED", (r.stdout or r.stderr)[:200]))
    elif ts:
        print(json.dumps({"event": "note", "msg": "bo qua tsc (khong co node_modules); Claude phai tu build"}))
    for code, detail in errors:
        print(json.dumps({"event": "check_error", "code": code, "detail": str(detail)}, ensure_ascii=False))
    print(json.dumps({"event": "check_done", "files": len(files), "errors": len(errors)}))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
