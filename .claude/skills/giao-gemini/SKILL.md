---
name: giao-gemini
description: Dung khi nguoi dung muon Claude lap ke hoach va nghiem thu con Gemini (agy) viet code cho ic3-manager. Chay khi ho goi /giao-gemini hoac noi "giao Gemini lam".
---

# Giao viec cho Gemini, Claude nghiem thu (ic3-manager)

Doc `.agent/README.md` va `AGENTS.md` truoc. Quy trinh o day la gia thuyet co bang chung, khong phai chan ly.

## Buoc 0: co nen giao khong
Theo thu tu, dung o cau "co" dau tien:
1. Mot script/lenh lam duoc khong can model? Viet script.
2. Viec nho (vai file, sua vai dong) hoac can phan doan? Claude tu lam, KHONG giao.
3. Viec du lon, kiem duoc bang may (checker/build/test)? Giao Gemini.
Neu quyet dinh khong giao, noi ngan gon vi sao va tu lam.

## Buoc 1: chuan bi (dung worktree, khong dung main)
- Kiem `agy --version`. Khong co thi dung lai, bao nguoi dung.
- `git status` phai sach. Neu khong, dung lai va hoi.
- `git worktree add ../ic3-gemini-<id> -b gemini/<id>`. Worktree khong co `.env` (da gitignore), day la y dinh.
- Viec phai chay trong worktree, KHONG sua repo goc trong luc batch chay.

## Buoc 2: viet de bai
Copy `.agent/templates/work_order.md`, dien day du; liet ke path duoc phep sua that hep. Dua tieu chi "xong" la lenh
`python .agent/check_ic3.py --base <nhanh> --allow "<glob>"`. De bai viet bang tieng Anh.
Tao `jobs.json` tu `.agent/templates/jobs.example.json` (nam trong thu muc tam, ngoai repo).

## Buoc 3: chay
`python .agent/run_agy.py <jobs.json> --logs <thu muc log ngoai repo> --repo <worktree>`
Doc dong `run`: `failed` = 0 va `stray_writes` = 0. Co `stray_write` thi dieu tra, khong bo qua.

## Buoc 4: nghiem thu (khong bao gio tin bao cao cua Gemini)
1. Tu chay `check_ic3.py` trong worktree, can ma 0.
2. Doc TOAN BO diff (`git diff <nhanh>...`). Soi: kiem tra quyen/dang nhap, SQL/ORM, nhanh loi, exception bi nuot,
   lo thong tin trong `str(exc)`, thay doi hinh dang API, text tieng Viet.
3. Backend: import app va chay thu endpoint bi anh huong. Frontend: `npm run build` (can node_modules).
4. Co loi thi viet lai de bai chi ro cho can sua va giao lai. Toi da 2 vong; qua do Claude tu sua hoac bao nguoi dung.

## Buoc 5: ket thuc
- Commit tren nhanh `gemini/<id>` (tac gia nguoi dung, trailer Co-Authored-By cua Claude va Gemini neu phu hop).
- Them mot dong vao `.agent/LEDGER.md`.
- BAO nguoi dung ket qua va xin xac nhan truoc khi merge vao main hoac push. KHONG tu merge, KHONG tu push.
- Don worktree khi xong: `git worktree remove ../ic3-gemini-<id>`.

## Gioi han cung
- Khong giao: nghiem thu, review bao mat, chan doan loi, viec tac dong ra ngoai (gui mail, deploy, push).
- Khong dua bi mat vao de bai. Khong de Gemini doc `.env` hay file `.db`.
- Che do `write` cua agy khong co sandbox: chi dung voi dau vao tin cay, trong worktree dung mot lan.
