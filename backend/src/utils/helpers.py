import os
import json
import re

def load_json(path):
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_json_path(path, is_admin=False):
    """
    Trả về đường dẫn file .draft.json nếu là admin và file đó tồn tại.
    Nếu không, trả về đường dẫn file gốc.
    """
    if not is_admin:
        return path
    
    draft_path = path.replace('.json', '.draft.json')
    if os.path.exists(draft_path):
        return draft_path
    return path

def publish_draft(path):
    """
    Sao chép nội dung từ file .draft.json sang file .json và xóa file draft.
    """
    draft_path = path.replace('.json', '.draft.json')
    if os.path.exists(draft_path):
        data = load_json(draft_path)
        save_json(path, data)
        try:
            os.remove(draft_path)
        except:
            pass
        return True
    return False

def parse_danh_sach(path):
    """
    Parse file danhsach.txt (Tab separated)
    Trả về: { pc_num: fullName }
    """
    mapping = {}
    if not os.path.exists(path):
        return mapping
    
    with open(path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
        
    seq_pc = 0
    for line in lines:
        line = line.strip()
        if not line: continue
        
        cols = [c.strip() for c in line.split('\t')]
        if not cols: continue
        
        # Skip header
        first_col = cols[0].lower()
        if first_col in ['họ và tên', 'stt', '#', 'họ']:
            continue
            
        pc_num = 0
        # Tìm cột PC
        for col in cols:
            if re.match(r'^PC\d+', col, re.IGNORECASE):
                pc_num = int(re.sub(r'[^0-9]', '', col))
                break
        
        # Format D (Sequential PC)
        if pc_num == 0 and 14 <= len(cols) <= 20:
            seq_pc += 1
            pc_num = seq_pc
            
        if pc_num > 0:
            full_name = cols[0].strip()
            # Nếu có cột tên riêng (thường là cột 1)
            if len(cols) > 1 and cols[1] and not re.match(r'^(OT|GM|\d+|PC)', cols[1], re.IGNORECASE):
                name_part = cols[1].strip()
                if name_part and name_part not in full_name:
                    full_name = (full_name + " " + name_part).strip()
            
            # Làm sạch tên rác (nếu chỉ có 1 chữ cái hoặc rỗng)
            if not full_name or len(full_name) <= 1:
                continue
                
            mapping[str(pc_num)] = full_name
            
    return mapping

def parse_scores(scores_dir):
    """
    Parse các file .html trong thư mục scores
    Trả về: { pc_num: { 'score': X, 'count': Y, 'time': Z, 'ot': W } }
    """
    results = {}
    if not os.path.exists(scores_dir):
        return results
        
    for filename in os.listdir(scores_dir):
        if not filename.endswith('.html') or filename.startswith('._'):
            continue
            
        # Thử nhiều định dạng regex khác nhau
        pc_num = None; ot_type = ""; score = 0; duration = "00-00-00"; timestamp = 0
        
        # 1. Format đầy đủ: PC01_OT1_Diem_950_00-12-45_1620546000.html
        m1 = re.search(r'PC(\d+)_([^_]+)_Diem_(\d+)_([\d\-]+)_(\d+)', filename, re.IGNORECASE)
        # 2. Format rút gọn (có OT): PC01_OT1_Diem_950.html
        m2 = re.search(r'PC(\d+)_([^_]+)_Diem_(\d+)', filename, re.IGNORECASE)
        # 3. Format tối giản (không OT): PC01_Diem_950.html
        m3 = re.search(r'PC(\d+)_Diem_(\d+)', filename, re.IGNORECASE)

        if m1:
            pc_num = str(int(m1.group(1))); ot_type = m1.group(2).upper(); score = int(m1.group(3)); duration = m1.group(4); timestamp = int(m1.group(5))
        elif m2 and not m2.group(2).isdigit():
            pc_num = str(int(m2.group(1))); ot_type = m2.group(2).upper(); score = int(m2.group(3))
        elif m3:
            pc_num = str(int(m3.group(1))); score = int(m3.group(2))
            
        # Nếu ot_type là "DIEM" (do m2 bắt nhầm), reset nó
        if ot_type == "DIEM": ot_type = ""
            
        if pc_num:
            if pc_num not in results:
                results[pc_num] = {
                    'max_score': -1,
                    'count': 0,
                    'last_time': '',
                    'last_ot': '',
                    'all_scores': []
                }
            
            results[pc_num]['count'] += 1
            results[pc_num]['all_scores'].append({
                'score': score,
                'ot': ot_type,
                'duration': duration,
                'time': timestamp
            })
            
            if score >= results[pc_num]['max_score']:
                results[pc_num]['max_score'] = score
                results[pc_num]['last_time'] = duration
                results[pc_num]['last_ot'] = ot_type
                
    return results
def get_server_ip():
    import socket
    
    # 1. Try to connect to a dummy address to get active local LAN interface IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and ip not in ('127.0.0.1', '127.0.0.2', '0.0.0.0'):
            return ip
    except:
        pass

    # 2. Scan system network interfaces for local LAN IPs (192.168.x.x, 10.x.x.x, 172.16.x.x)
    try:
        hostname = socket.gethostname()
        ips = socket.gethostbyname_ex(hostname)[2]
        for ip in ips:
            if not ip.startswith('127.') and not ip.startswith('169.254') and ip != '0.0.0.0':
                return ip
    except:
        pass

    # 3. Fallback: try socket.gethostbyname
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and ip not in ('127.0.0.1', 'localhost', '0.0.0.0'):
            return ip
    except:
        pass

    return "127.0.0.1"


def get_server_hostname():
    """
    Lấy hostname .local của máy tính (mDNS/Bonjour).
    Hostname này cố định, không thay đổi khi IP đổi.
    Ví dụ: MacBook-GV.local, DESKTOP-ABC.local
    
    macOS: Bonjour tích hợp sẵn, luôn hoạt động.
    Windows: Cần cài Bonjour (đi kèm iTunes) hoặc dùng hostname thường.
    """
    import socket
    import platform
    
    try:
        hostname = socket.gethostname()
        # Loại bỏ .local nếu đã có (tránh trùng .local.local)
        hostname = hostname.replace('.local', '')
        
        # Trên macOS, dùng Bonjour hostname (.local)
        if platform.system() == 'Darwin':
            # Thử lấy tên máy từ scutil (chính xác hơn gethostname)
            try:
                import subprocess
                result = subprocess.run(
                    ['scutil', '--get', 'LocalHostName'],
                    capture_output=True, text=True, timeout=2
                )
                if result.returncode == 0 and result.stdout.strip():
                    hostname = result.stdout.strip()
            except:
                pass
        
        # Thêm .local suffix cho mDNS resolution
        local_hostname = f"{hostname}.local"
        return local_hostname
        
    except Exception:
        # Fallback: dùng IP nếu không lấy được hostname
        return get_server_ip()

def normalize_ot(ot_str):
    """
    Chuẩn hóa tên bài thi giống bản PHP:
    - Loại bỏ (Published), .exe, ...
    - Tìm mẫu OTx hoặc GMx ưu tiên.
    - Giữ nguyên các tên khác (ví dụ CauHoiBoSung).
    """
    if not ot_str: return "UNKNOWN"
    
    # 1. Dọn dẹp sơ bộ
    ot_str = ot_str.replace('-', ' ')
    ot_str = re.sub(r'\s*\(Published\)', '', ot_str, flags=re.IGNORECASE)
    ot_str = re.sub(r'PUBLISHED', '', ot_str, flags=re.IGNORECASE)
    ot_str = re.sub(r'\.exe$', '', ot_str, flags=re.IGNORECASE)
    
    # 2. Tìm mẫu chuẩn OT/GM
    m = re.search(r'(OT|GM)\s*0*(\d+)', ot_str, re.IGNORECASE)
    if m:
        return f"{m.group(1).upper()}{int(m.group(2))}"
    
    # 3. Trả về tên đã dọn dẹp
    final = ot_str.strip()
    return final if final else "UNKNOWN"

def parse_scores_regex(scores_dir):
    """Bản nâng cấp của parse_scores với gom nhóm theo OT và chuẩn hóa thông minh"""
    results = {}
    if not os.path.exists(scores_dir): return results
    
    for fn in os.listdir(scores_dir):
        if not fn.endswith('.html') or fn.startswith('._'): continue
        
        pc_num = None; ot = ""; sc = 0; dur = "00-00-00"
        
        # Format mới: PC01_OT1_Diem_950_00-12-45_...
        m = re.search(r'PC(\d+)_([^_]+)_Diem_([\d\.]+)_([\d\-]+)', fn, re.IGNORECASE)
        if m:
            pc_num = str(int(m.group(1)))
            ot = normalize_ot(m.group(2))
            sc_str = m.group(3)
            dur = m.group(4)
            sc = float(sc_str) if '.' in sc_str else int(sc_str)
        else:
            # Format cũ: PC01_Diem_950.html -> Mặc định OT1
            m2 = re.search(r'PC(\d+)_Diem_([\d\.]+)', fn, re.IGNORECASE)
            if m2: 
                pc_num = str(int(m2.group(1)))
                ot = "OT1"
                sc_str = m2.group(2)
                sc = float(sc_str) if '.' in sc_str else int(sc_str)
        
        if pc_num:
            if pc_num not in results:
                results[pc_num] = {'score': '', 'timeSpent': '', 'lastOT': '', 'scoresByOT': {}, 'max': 0}
            
            # Lưu vào danh sách theo OT
            if ot not in results[pc_num]['scoresByOT']:
                results[pc_num]['scoresByOT'][ot] = []
            results[pc_num]['scoresByOT'][ot].append(sc)
            
            # Cập nhật thông tin hiển thị (lấy kết quả mới nhất/cao nhất tạm thời)
            # Quan trọng: quanly.js sẽ xử lý aggregation chính xác hơn
            all_sc_list = []
            for o_name, o_scores in results[pc_num]['scoresByOT'].items():
                all_sc_list.extend(o_scores)
            
            results[pc_num]['score'] = '|'.join(map(str, all_sc_list))
            results[pc_num]['max'] = max(all_sc_list) if all_sc_list else 0
            
            # Ưu tiên lấy OT và thời gian của lần thi có điểm cao nhất
            if sc >= results[pc_num]['max']:
                results[pc_num]['timeSpent'] = dur
                results[pc_num]['lastOT'] = ot
                
    return results
def update_config_from_list(ten_lop, data, folder_ds):
    lines = data.split('\n')
    new_targets = {}; new_ots = {}; clear_targets = []
    is_sheet_format = False; seq_pc = 0
    
    # Load current to merge
    target_path = os.path.join(folder_ds, f'target_{ten_lop}.json')
    ot_path = os.path.join(folder_ds, f'ot_config_{ten_lop}.json')
    targets = load_json(target_path); ots = load_json(ot_path)

    for line in lines:
        line = line.strip()
        if not line: continue
        cols = [c.strip() for c in line.split('\t')]
        
        first_col = cols[0].lower()
        if first_col in ['họ và tên', 'stt', '#', 'họ']: continue
        
        vi_tri_index = -1
        for i, col in enumerate(cols):
            if re.match(r'^PC\d+', col, re.IGNORECASE):
                vi_tri_index = i; break
        
        pc_num = 0; bai_giao = ''; muc_tieu = ''; detected = False
        
        if vi_tri_index != -1:
            pc_num = int(re.sub(r'[^0-9]', '', cols[vi_tri_index]))
            if 1 <= pc_num <= 60:
                # Format A: Full Google Sheet (PC tại cột 4, >=28 cột)
                if vi_tri_index == 4 and len(cols) >= 28:
                    detected = True; bai_giao = cols[26]; muc_tieu = cols[27]
                # Format B: Compact Sheet (PC tại cột 8, >=11 cột)
                elif vi_tri_index == 8 and len(cols) >= 11:
                    detected = True; bai_giao = cols[9]; muc_tieu = cols[10]
                # Format C: Simple (Tên PC BàiGiao MụcTiêu)
                elif len(cols) > vi_tri_index + 1:
                    next_col = cols[vi_tri_index + 1]
                    if re.search(r'(OT|GM|Hoàn thành|Kiểm tra)', next_col, re.IGNORECASE):
                        detected = True; bai_giao = next_col
                        muc_tieu = cols[vi_tri_index + 2] if len(cols) > vi_tri_index + 2 else ''
        # Format D: Sequential PC
        elif 14 <= len(cols) <= 20:
            potential_ot = cols[9] if len(cols) > 9 else ''
            if re.search(r'(OT|GM|Hoàn thành|Kiểm tra)', potential_ot, re.IGNORECASE):
                seq_pc += 1; pc_num = seq_pc; detected = True
                bai_giao = potential_ot; muc_tieu = cols[10] if len(cols) > 10 else ''
        
        if detected and 1 <= pc_num <= 60:
            is_sheet_format = True
            if bai_giao and re.search(r'(OT|GM|Hoàn thành|Kiểm tra)', bai_giao, re.IGNORECASE):
                new_ots[str(pc_num)] = bai_giao
            if muc_tieu == '---': clear_targets.append(str(pc_num))
            elif muc_tieu and (muc_tieu.isdigit() or re.match(r'^\d+(\s*,\s*\d+)*$', muc_tieu)):
                new_targets[str(pc_num)] = muc_tieu
                
    if is_sheet_format:
        targets.update(new_targets)
        ots.update(new_ots)
        for pc in clear_targets: targets.pop(pc, None)
        save_json(target_path, targets); save_json(ot_path, ots)

def _send_email_async(subject, body, recipient):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    try:
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
    except:
        smtp_port = 587

    # Nếu chưa cấu hình SMTP trong file .env, in thông tin ra terminal/log
    if not smtp_user or not smtp_password:
        print(f"\n[EMAIL LOG - CHƯA CẤU HÌNH SMTP_USER & SMTP_PASSWORD TRONG FILE .env]")
        print(f"Người nhận: {recipient}")
        print(f"Tiêu đề: {subject}")
        print(f"Nội dung: Trình duyệt gửi thông báo đăng ký tài khoản.")
        print("=> Hãy thêm SMTP_USER và SMTP_PASSWORD vào backend/.env để hệ thống tự động gửi email thực tế!\n")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = recipient
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'html', 'utf-8'))

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipient, msg.as_string())
        server.quit()
        print(f"[EMAIL SUCCESS] Gửi email thông báo tới {recipient} thành công!")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Không thể gửi email tới {recipient}: {e}")
        return False

def send_registration_notification(username, name, account_type):
    import threading
    recipient = os.getenv('NOTIFY_EMAIL', 'thuanan524@gmail.com')
    subject = f"🔔 [IC3 Manager] Có tài khoản đăng ký mới: {username}"
    
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0;">YÊU CẦU PHÊ DUYỆT TÀI KHOẢN</h2>
        </div>
        <p>Xin chào Admin,</p>
        <p>Hệ thống <strong>IC3 Manager</strong> vừa nhận được yêu cầu đăng ký tài khoản mới từ một giáo viên/thành viên. Dưới đây là thông tin chi tiết:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;" width="150">Email / Tên ĐN:</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">{username}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">Họ và Tên:</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">{name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">Nguồn đăng ký:</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-transform: capitalize;">{account_type}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">Trạng thái:</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #ef4444; font-weight: bold;">Chờ Phê Duyệt</td>
          </tr>
        </table>
        
        <p>Vui lòng đăng nhập vào <strong>Bảng điều khiển Admin (Admin Console)</strong> để kiểm tra hồ sơ và phê duyệt cấp quyền cho tài khoản này.</p>
        
        <div style="text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 0.85rem; color: #64748b;">
          Đây là email tự động từ hệ thống IC3 Manager. Vui lòng không trả lời thư này.
        </div>
      </body>
    </html>
    """
    
    # Chạy ngầm trong Thread riêng để tránh làm chậm phản hồi trang đăng ký
    t = threading.Thread(target=_send_email_async, args=(subject, body, recipient))
    t.daemon = True
    t.start()

