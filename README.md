# ic3-thudiem-offline (kho rieng tu)

Ban offline cua IC3 Manager: chi thu diem bai thi Flash. Xem ke hoach day du trong tai lieu "Ke hoach ban Offline".

## Thanh phan
| Thu muc | Noi dung | Trang thai |
|---|---|---|
| `tools/taodethi/` | TaoDeThi: keo file de .exe vao, ra file `*_LAN.exe` | da viet, da kiem thu tren Linux |
| `tests/` | Kiem thu | 7 ca |

## Kiem thu TaoDeThi
```
set IC3_DE_MAU=D:\Project\ic3-manager\DeThi_Flash
set IC3_OLD_PATCH=D:\Project\ic3-manager\scripts\patch_sameshow_exe.py
python -B -m unittest tests.test_taodethi -v
```
`IC3_OLD_PATCH` doi chieu tung byte voi script cu. Khong dat hai bien thi cac ca can de that duoc bo qua.

## Build TaoDeThi.exe (Windows 10/11)
Chay `tools\taodethi\build_taodethi.bat`. Can Python 3.12, 3.13 hoac 3.14 (Nuitka 4.2 tro len ho tro 3.14). Neu may chua co Python, file bat de nghi cai Python 3.13 bang winget. Nuitka tu cai bang pip.
Ket qua: `dist\TaoDeThi.exe`. Khong dung PyInstaller vi no de bi dich nguoc.

## Bao mat
Khong dua len GitHub: file `.exe`, `.lic`, khoa ky (`*.key`, `*.pem`, `secrets/`), de thi, du lieu.
