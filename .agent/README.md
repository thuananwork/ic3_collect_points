# .agent: Claude lap ke hoach + nghiem thu, Gemini viet code

Dua tren bo "Giao viec cho Gemini tu Claude Code" (Nguyen Xuan Tai, MIT/CC BY 4.0). `run_agy.py` lay nguyen ban,
giay phep o `LICENSE-run_agy.txt`.

## Dung the nao
Mo ic3-manager trong Claude Code (VS Code tren Windows), go: `/giao-gemini <mo ta tinh nang>`.
Claude se tu quyet dinh co nen giao khong, lap worktree, viet de bai, chay Gemini, chay bo kiem, doc diff,
roi bao lai de ban xac nhan merge.

## Can co truoc
- `agy` chay duoc trong terminal va da dang nhap.
- Python 3 va git. Kiem ten model trong tai khoan (mac dinh `gemini-3.8-flash-high`).
- Nen xoay cac khoa trong `backend/.env` neu tung de lo, vi che do write khong co sandbox.

## File
| File | Dung de |
|---|---|
| `run_agy.py` | chay batch agy, bat ghi lac/timeout |
| `check_ic3.py` | bo kiem: pham vi file, bien dich Python, bi mat, exception bi nuot, tsc |
| `templates/work_order.md` | khung de bai |
| `templates/jobs.example.json` | mau jobs.json |
| `LEDGER.md` | so ghi chep tung batch |

Bo kiem chi bat HINH DANG. Loi logic chi Claude doc diff moi thay.
