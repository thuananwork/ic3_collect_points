import os
import json
import time
import urllib.request
import urllib.parse
from flask import request, jsonify
from flask_login import current_user
from src.config.settings import Config
from src.config.database import db_session
from src.models.models_db import ClassDB
from src.utils.helpers import load_json, save_json
from src.utils.db_helpers import get_or_create_computer, get_or_create_workstation, get_req_data

STORAGE_PATH = Config.STORAGE_PATH

def handle_gsheet_tabs():
    return jsonify({'tabs': Config.GSHEET_TABS})

def handle_fetch_gsheet():
    tab = request.args.get('tab', '').strip()
    force_refresh = request.args.get('force', '').lower() == 'true'
    
    if tab not in Config.GSHEET_TABS:
        return jsonify({'error': f'Tab không hợp lệ: {tab}'}), 400
        
    cache_dir = os.path.join(STORAGE_PATH, 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f'gsheet_{tab.replace(".", "_")}.json')
    
    # 10 minutes cache unless force refresh is requested
    if not force_refresh and os.path.exists(cache_file) and (time.time() - os.path.getmtime(cache_file)) < 600:
        return jsonify(load_json(cache_file))
        
    if not Config.GSHEET_API_KEY:
        return jsonify({'error': 'Chưa cấu hình GSHEET_API_KEY trong backend/.env'}), 500

    url = f"https://sheets.googleapis.com/v4/spreadsheets/{Config.GSHEET_ID}/values/{urllib.parse.quote(tab)}?key={Config.GSHEET_API_KEY}&valueRenderOption=UNFORMATTED_VALUE"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
        rows = res_data.get('values', [])
        if not rows:
            return jsonify({'error': f'Tab "{tab}" không có dữ liệu.'}), 400
            
        headers = rows[0]
        students = []
        for i in range(1, len(rows)):
            row = rows[i]
            stt = str(row[0]).strip() if len(row) > 0 and row[0] is not None else ''
            if not stt or not stt.isdigit():
                continue
                
            student = {}
            for col_idx, header_name in enumerate(headers):
                header_name = str(header_name).strip()
                if not header_name: continue
                student[header_name] = row[col_idx] if col_idx < len(row) else ''
            students.append(student)
            
        result = {
            'tab': tab,
            'headers': headers,
            'students': students,
            'values': rows,
            'count': len(students),
            'timestamp': time.strftime('%H:%M:%S %d/%m/%Y')
        }
        save_json(cache_file, result)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching Google Sheet: {e}")
        return jsonify({'error': f'Không thể kết nối Google Sheets API: {str(e)}'}), 500

def handle_save_gsheet_targets(ten_lop):
    data = get_req_data()
    ots = data.get('ots', {})
    if isinstance(ots, str): ots = json.loads(ots)
    targets = data.get('targets', {})
    if isinstance(targets, str): targets = json.loads(targets)
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    for pc, val in ots.items():
        comp = get_or_create_computer(int(current_user.id), pc)
        for is_df in [False, True]:
            ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_df)
            ws.assigned_exam_code = val if val else None
            
    for pc, val in targets.items():
        comp = get_or_create_computer(int(current_user.id), pc)
        for is_df in [False, True]:
            ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_df)
            ws.target_score = int(val) if val else None
            
    db_session.commit()
    return jsonify({"status": "success"})
