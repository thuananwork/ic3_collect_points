import os
import time
import json
import requests
from flask import request, jsonify
from flask_login import login_required

from src.middleware.auth import permission_required
from .api import api_bp

ALLOWED_SCRIPTS = ['SetupGame.bat', 'lay_ip.bat', 'set_ip.bat', 'XoaFile.bat', 'fix_firewall.bat']

@api_bp.route('/api/operation-tools/script', methods=['GET'])
@login_required
@permission_required('cong_cu_tien_ich')
def api_get_operation_script():
    name = request.args.get('name', '').strip()
    if name not in ALLOWED_SCRIPTS:
        return jsonify({"status": "error", "message": "Tên script không hợp lệ hoặc không được phép truy cập."}), 400
    
    routes_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(routes_dir, '../../../'))
    script_path = os.path.join(root_dir, 'scripts', name)
    
    if not os.path.exists(script_path):
        return jsonify({"status": "error", "message": "Không tìm thấy tệp tin script."}), 404
    
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(script_path, 'r', encoding='cp1258') as f:
                content = f.read()
        except Exception as e:
            return jsonify({"status": "error", "message": f"Không thể đọc file: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"Lỗi đọc file: {str(e)}"}), 500
        
    return jsonify({"status": "success", "content": content})

@api_bp.route('/api/operation-tools/script', methods=['POST'])
@login_required
@permission_required('cong_cu_tien_ich')
def api_save_operation_script():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    content = data.get('content', '')
    
    if name not in ALLOWED_SCRIPTS:
        return jsonify({"status": "error", "message": "Tên script không hợp lệ hoặc không được phép truy cập."}), 400
    
    routes_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(routes_dir, '../../../'))
    script_path = os.path.join(root_dir, 'scripts', name)
    
    try:
        os.makedirs(os.path.dirname(script_path), exist_ok=True)
        with open(script_path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write(content)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Lỗi ghi file: {str(e)}"}), 500
        
    return jsonify({"status": "success", "message": f"Đã lưu tệp tin {name} thành công."})

@api_bp.route('/api/operation-tools/gemini-fix', methods=['POST'])
@login_required
@permission_required('cong_cu_tien_ich')
def api_gemini_fix_script():
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    if not api_key:
        return jsonify({
            "status": "error", 
            "message": "Cấu hình thiếu: Vui lòng thêm biến GEMINI_API_KEY=your_key vào tệp .env trong thư mục backend để kích hoạt tính năng Gemini AI."
        }), 400
        
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    content = data.get('content', '')
    error_msg = data.get('error', '').strip()
    user_prompt = data.get('prompt', '').strip()
    
    if name not in ALLOWED_SCRIPTS:
        return jsonify({"status": "error", "message": "Tên script không hợp lệ."}), 400
        
    system_instruction = (
        "Bạn là trợ lý Gemini AI chuyên gia được tích hợp trực tiếp vào hệ thống \"IC3 Classroom Manager\" của Thầy Nguyễn Thuận An.\n"
        "Nhiệm vụ của bạn là hỗ trợ vận hành phòng máy thực hành Tin học chạy hệ điều hành Windows thông qua các tệp tin script tự động (.bat).\n\n"
        "Dưới đây là thông tin chi tiết về cấu trúc hệ thống và các tệp script để bạn có kiến thức nền tảng hỗ trợ:\n"
        "1. Cấu trúc mạng phòng máy:\n"
        "   - Máy giáo viên (Server) chạy ứng dụng Backend Flask trên cổng 5000 (Local IP ví dụ: 10.217.7.119 hoặc 192.168.50.1).\n"
        "   - Học sinh sử dụng các máy trạm con (Clients) được đặt tên theo định dạng PC-01, PC-02,..., PC-50.\n"
        "   - Hệ thống có chức năng tự động lấy IP máy con gửi về máy thầy để giám sát và chấm điểm thực hành.\n\n"
        "2. Chức năng chi tiết của các tệp tin .bat trong hệ thống:\n"
        "   - SetupGame.bat: Cài đặt tự động môi trường thi iSpring trên máy trạm. Tắt game cưỡng chế, dọn userdata cũ trong \"C:\\ProgramData\\PopCap Games\\PlantsVsZombies\\userdata\" và sao chép userdata chuẩn từ \"%~dp0userdata\", khởi chạy game.\n"
        "   - lay_ip.bat: Chạy trên máy con học sinh trong giờ thi để lấy tên máy (%COMPUTERNAME%) gửi thông qua curl đến máy thầy theo địa chỉ: \"http://<Server_IP>:5000/nhan_ip?pc=<PC_NAME>\". Địa chỉ IP tĩnh phòng máy ví dụ: 10.217.7.119 hoặc 192.168.50.1.\n"
        "   - set_ip.bat: Cấu hình địa chỉ IP tĩnh tự động cho máy con (Windows Ethernet) dùng netsh. IP tính tự động: PC-05 -> octet cuối = 100 + 5 = 105 -> IP = 192.168.50.105. Gateway: 192.168.50.1, Subnet Mask: 255.255.255.0. Yêu cầu quyền Administrator.\n"
        "   - XoaFile.bat: Chạy trên máy con để tắt các chương trình thi thử (OT1, OT2,... teo di thi, pikachu, goldminer, plants vs zombies, setupgame) và xóa sạch bài làm ca trước (các thư mục GAME, On_tap, giai_lao, Tin_hoc_dai_duong, userdata) trên ổ C, D, dọn dẹp cache iSpring và Google Chrome.\n"
        "   - fix_firewall.bat: Mở cổng Firewall và khắc phục lỗi kết nối dùng netsh advfirewall cho XAMPP_HTTP_SERVER hoặc cổng 80/5000.\n\n"
        "Hãy phản hồi bằng cách sửa lỗi hoặc tùy chỉnh nội dung file script .bat dựa trên mô tả lỗi của người dùng, đảm bảo cú pháp Windows Batch Script (.bat) chính xác, hoạt động tối ưu và an toàn."
    )
    
    prompt_content = f"Tên tệp tin: {name}\n\nNội dung hiện tại của file .bat:\n```batch\n{content}\n```\n"
    if error_msg:
        prompt_content += f"\nLỗi phát sinh hoặc triệu chứng gặp phải:\n{error_msg}\n"
    if user_prompt:
        prompt_content += f"\nYêu cầu tùy chỉnh bổ sung từ người dùng:\n{user_prompt}\n"
        
    prompt_content += "\n\nHãy sửa đổi hoặc cập nhật file .bat trên và phản hồi theo cấu trúc JSON quy định."
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt_content}]
        }],
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "fixed_content": {
                        "type": "STRING",
                        "description": "Nội dung đầy đủ của file .bat sau khi đã được chỉnh sửa/sửa lỗi."
                    },
                    "explanation": {
                        "type": "STRING",
                        "description": "Giải thích chi tiết về nguyên nhân lỗi và các điểm đã thay đổi bằng tiếng Việt."
                    }
                },
                "required": ["fixed_content", "explanation"]
            }
        }
    }
    
    models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"]
    last_error_msg = "Không có mô hình nào khả dụng."
    last_status_code = 502
    
    main_model_error = None
    main_model_status = None
    
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        # Thử lại tối đa 3 lần cho mỗi mô hình nếu gặp lỗi quá tải (503) hoặc quá giới hạn RPM (429)
        for attempt in range(3):
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=30)
                
                # Nếu gặp lỗi quá tải (503) hoặc giới hạn băng thông (429), tạm dừng và thử lại
                if r.status_code in [429, 503]:
                    try:
                        err_detail = r.json()
                        err_msg = err_detail.get('error', {}).get('message', r.text)
                    except:
                        err_msg = r.text
                    
                    if model == "gemini-3.5-flash":
                        main_model_error = err_msg
                        main_model_status = r.status_code
                        
                    last_error_msg = err_msg
                    last_status_code = r.status_code
                    
                    # Exponential backoff (đợi 1.5s, 3.0s, 4.5s)
                    time.sleep(1.5 * (attempt + 1))
                    continue
                
                # Nếu gặp lỗi khác (ví dụ: 404 mô hình không tồn tại, hoặc 400 cấu hình sai), chuyển sang mô hình tiếp theo
                if r.status_code != 200:
                    try:
                        err_detail = r.json()
                        err_msg = err_detail.get('error', {}).get('message', r.text)
                    except:
                        err_msg = r.text
                        
                    if model == "gemini-3.5-flash":
                        main_model_error = err_msg
                        main_model_status = r.status_code
                        
                    last_error_msg = err_msg
                    last_status_code = r.status_code
                    break # Thoát vòng lặp attempt để chuyển sang model tiếp theo
                
                # Thành công! Parse kết quả
                res_json = r.json()
                candidates = res_json.get('candidates', [])
                if not candidates:
                    last_error_msg = "Gemini API không phản hồi kết quả hợp lệ."
                    last_status_code = 502
                    break
                    
                text_content = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                if not text_content:
                    last_error_msg = "Gemini API phản hồi phần thân rỗng."
                    last_status_code = 502
                    break
                
                parsed_response = json.loads(text_content)
                return jsonify({
                    "status": "success",
                    "fixed_content": parsed_response.get('fixed_content', ''),
                    "explanation": parsed_response.get('explanation', ''),
                    "model_used": model
                })
                
            except requests.exceptions.Timeout:
                last_error_msg = "Kết nối đến Gemini API bị quá giờ (Timeout)."
                last_status_code = 504
                time.sleep(1.5)
            except Exception as e:
                last_error_msg = str(e)
                last_status_code = 500
                break # Thử model khác
                
    # Ưu tiên trả về lỗi của mô hình chính (gemini-2.5-flash) nếu có lỗi thực tế (như 429, 503)
    if main_model_error and main_model_status in [429, 503]:
        return jsonify({"status": "error", "message": f"Lỗi Gemini API: {main_model_error}"}), main_model_status
        
    return jsonify({"status": "error", "message": f"Lỗi Gemini API: {last_error_msg}"}), last_status_code


@api_bp.route('/api/operation-tools/quizzes', methods=['GET'])
@login_required
@permission_required('cong_cu_tien_ich')
def api_list_operation_quizzes():
    routes_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(routes_dir, '../../../'))
    quizzes_dir = os.path.join(root_dir, 'quizzes')
    
    if not os.path.exists(quizzes_dir):
        return jsonify([])
        
    from src.models.models_db import QuizDB
    from src.config.database import db_session
    import re
    
    files = []
    try:
        for name in os.listdir(quizzes_dir):
            if name.startswith('._') or not os.path.isfile(os.path.join(quizzes_dir, name)):
                continue
                
            desc = "File trắc nghiệm phòng máy."
            if name == "Quiz_Lop_6.quiz":
                desc = "Bộ câu hỏi trắc nghiệm ôn tập cho học sinh khối 6."
            elif name == "Quiz_Lop_7.quiz":
                desc = "Bộ câu hỏi trắc nghiệm ôn tập cho học sinh khối 7."
            elif name == "Quiz_Lop_8.quiz":
                desc = "Bộ câu hỏi trắc nghiệm ôn tập cho học sinh khối 8."
            elif name.endswith('_Standalone.html'):
                m = re.search(r'Quiz_(\d+)_Standalone\.html', name)
                if m:
                    quiz_id = int(m.group(1))
                    quiz = db_session.query(QuizDB).filter(QuizDB.quiz_id == quiz_id).first()
                    if quiz:
                        desc = f"Tệp trắc nghiệm offline tự sinh cho bài: {quiz.title}"
                    else:
                        desc = "Tệp trắc nghiệm offline (standalone)."
                else:
                    desc = "Tệp trắc nghiệm offline (standalone)."
                    
            files.append({
                "name": name,
                "desc": desc,
                "url": f"quizzes/{name}"
            })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
        
    # Sắp xếp để file HTML nổi lên đầu tiên
    files = sorted(files, key=lambda x: (not x['name'].endswith('.html'), x['name']))
    return jsonify(files)

