# Ledger: moi batch giao Gemini mot dong

| # | Ngay | Viec | Model | Thoi gian | Checker | Stray | Loi Claude tim thay khi review | Claude tu lam co re hon khong? |
|---|---|---|---|---|---|---|---|---|

Ghi cach uoc luong "Claude tu lam" o day de quyet dinh quy tac nao dang giu.
| 1 | 2026-10-23 | Test cho /api/save-score (tests/test_save_score.py) | gemini-3.8-flash-high | 709s | exit 0 | 0 | Copy ca .env va storage/ sang thu muc tam; assert chuoi `"..\ "` co dau cach thua nen khong bao gio khop; chua co ca kiem file ghi ra ngoai class_<id> | Tu viet re hon (~15 phut); giao Gemini chi hop ly khi can nhieu ca |
