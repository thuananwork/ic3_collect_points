import os
import re
import time
from flask import request, jsonify
from flask_login import current_user
from sqlalchemy import text
from src.config.database import db_session
from src.models.models_db import ComputerDB, UserDB
from src.utils.helpers import get_server_ip
from src.utils.rate_limit import limiter
from src.utils.db_helpers import get_or_create_computer, get_pc_key, get_req_data

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Tên máy hợp lệ (COMPUTERNAME của Windows tối đa 15 ký tự: chữ, số, '-' và '_')
PC_NAME_RE = re.compile(r'^[A-Za-z0-9_-]{1,15}$')
SERVER_HOST_RE = re.compile(r'^[A-Za-z0-9.\-]{1,253}$')

SCRIPTS_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', '..', '..', 'scripts'))
THUDIEM_PS1 = os.path.join(SCRIPTS_DIR, 'ThuDiem_Flash.ps1')


def build_lay_ip_bat(srv_ip, user_id):
    """Nội dung lay_ip.bat: gửi IP máy học sinh về máy thầy, rồi bật bộ thu điểm bài thi Flash chạy nền."""
    base = f"http://{srv_ip}:5000"
    lines = [
        "@echo off",
        "set pcname=%COMPUTERNAME%",
        "set res=",
        f'for /f "delims=" %%r in (\'curl -s "{base}/nhan_ip?pc=%pcname%&user_id={user_id}"\') do set res=%%r',
        # Bộ thu điểm bài thi Flash (.exe) được tải từ máy thầy, nên không phải chép tay xuống từng máy
        f'curl -s -o "%TEMP%\\ThuDiem_Flash.ps1" "{base}/tools/ThuDiem_Flash.ps1"',
        f'start "" /min powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%TEMP%\\ThuDiem_Flash.ps1" -Watch -Server {base}',
        "timeout /t 3",
        'if "%res%"=="OK" goto selfdel',
        "echo Khong gui duoc IP ve may thay. Kiem tra mang roi chay lai file nay.",
        "pause",
        "exit",
        ":selfdel",
        # Gửi xong thì tự xoá file này khỏi máy học sinh
        '(goto) 2>nul & del "%~f0" & exit',
    ]
    return "\r\n".join(lines) + "\r\n"


def handle_generate_bat():
    data = get_req_data()
    srv_ip = data.get('server_ip') or get_server_ip()
    if not SERVER_HOST_RE.match(str(srv_ip)):
        return jsonify({'ok': False, 'message': 'server_ip không hợp lệ'}), 400
    content = build_lay_ip_bat(srv_ip, int(current_user.id))

    os.makedirs(SCRIPTS_DIR, exist_ok=True)
    with open(os.path.join(SCRIPTS_DIR, 'lay_ip.bat'), 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    return jsonify({'ok': True, 'serverIP': srv_ip})


def handle_tool_thudiem():
    """Phát file ThuDiem_Flash.ps1 (cố định, không nhận tên file từ người dùng) cho máy học sinh tải."""
    from flask import send_file
    if not os.path.isfile(THUDIEM_PS1):
        return "ERROR: Not found", 404
    return send_file(THUDIEM_PS1, mimetype='text/plain', as_attachment=False)


def handle_nhan_ip():
    ip = request.remote_addr
    if not limiter.allow(f"nhanip:{ip}", 30, 60):
        return "ERROR: Too many requests", 429

    pc = (request.args.get('pc') or '').strip()
    user_id_str = request.args.get('user_id')

    if not pc:
        return "ERROR: Missing PC Name", 400
    if not PC_NAME_RE.match(pc):
        return "ERROR: Invalid PC Name", 400

    try:
        user_id = int(user_id_str) if user_id_str else 1
    except ValueError:
        return "ERROR: Invalid user_id", 400

    owner = db_session.query(UserDB).filter(UserDB.user_id == user_id).first()
    if not owner or (not owner.is_approved and owner.role != 'admin'):
        return "ERROR: Unknown user", 400

    comp = get_or_create_computer(user_id, pc)
    comp.ip_address = ip
    comp.last_updated = text("CURRENT_TIMESTAMP")
    db_session.commit()
    return "OK"

def handle_clear_ip_mapping():
    db_session.query(ComputerDB).filter(ComputerDB.user_id == int(current_user.id)).update({ComputerDB.ip_address: "0.0.0.0"})
    db_session.commit()
    return jsonify({"status": "success"})

def handle_get_ip_mapping():
    computers = db_session.query(ComputerDB).filter(ComputerDB.user_id == int(current_user.id)).all()
    comp_map = {get_pc_key(c.pc_name): c.ip_address for c in computers if c.ip_address != "0.0.0.0"}
    
    ip_data = []
    raw_ip_count = 0
    for i in range(1, 51):
        pc_key = str(i)
        ip = comp_map.get(pc_key, "")
        if ip:
            raw_ip_count += 1
        ip_data.append({
            'ip': ip,
            'pcName': f"PC{i:02d}",
            'pcNum': i
        })
        
    server_ip = get_server_ip()
    mtime = time.strftime('%H:%M:%S %d/%m/%Y')
    return jsonify({
        'ipMapping': ip_data,
        'serverIP': server_ip,
        'totalPCs': raw_ip_count,
        'lastModified': mtime
    })
