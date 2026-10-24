import os
import json
import base64
from src.utils.helpers import get_server_ip, get_server_hostname

def export_standalone_html(quiz, questions, output_dir, filename=None):
    """
    Exports a quiz as a single self-contained HTML file.
    Saves it to output_dir/Quiz_<quiz_id>_Standalone.html or output_dir/<filename>.html.
    It reads modular templates (HTML, CSS, JS) from the templates/ directory,
    inserts the dynamic quiz data, and outputs a single standalone HTML.
    """
    from flask import request, has_request_context
    
    # Lấy hostname (.local) để không bị ảnh hưởng khi IP đổi
    server_hostname = get_server_hostname()
    server_ip = get_server_ip()
    
    if has_request_context():
        # Dùng hostname thay vì IP từ request
        server_url = f"http://{server_hostname}:5000"
        fallback_url = request.url_root.rstrip('/')
    else:
        server_url = f"http://{server_hostname}:5000"
        fallback_url = f"http://{server_ip}:5000"
    
    # Process questions to encode answers in base64
    processed_questions = []
    for q in questions:
        # options are already parsed as list/dict or JSON string in caller
        options = q.get('options')
        if isinstance(options, str):
            try:
                options = json.loads(options)
            except:
                pass
                
        correct_ans = q.get('correct_answer')
        correct_ans_str = json.dumps(correct_ans, ensure_ascii=False)
        correct_ans_b64 = base64.b64encode(correct_ans_str.encode('utf-8')).decode('utf-8')
        
        processed_questions.append({
            "id": q.get('question_id'),
            "type": q.get('question_type'),
            "text": q.get('question_text'),
            "image": q.get('image_url') or "",
            "options": options,
            "answer_b64": correct_ans_b64,
            "points": q.get('points', 1)
        })

    quiz_data = {
        "id": quiz.quiz_id,
        "title": quiz.title,
        "description": quiz.description or "",
        "time_limit": quiz.time_limit,
        "questions": processed_questions
    }

    # Load template files
    utils_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(utils_dir, 'templates')
    
    html_template_path = os.path.join(templates_dir, 'template_standalone.html')
    css_template_path = os.path.join(templates_dir, 'template_standalone.css')
    js_template_path = os.path.join(templates_dir, 'template_standalone.js')
    
    try:
        with open(html_template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        with open(css_template_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
        with open(js_template_path, 'r', encoding='utf-8') as f:
            js_content = f.read()
    except Exception as e:
        raise RuntimeError(f"Error loading offline HTML templates: {e}")

    # Process JS placeholders
    quiz_data_json = json.dumps(quiz_data, ensure_ascii=False)
    js_content = js_content.replace('{{QUIZ_DATA_JSON}}', quiz_data_json)
    js_content = js_content.replace('{{SERVER_URL}}', server_url)
    js_content = js_content.replace('{{FALLBACK_URL}}', fallback_url)
    
    # Process HTML placeholders
    final_html = html_content
    final_html = final_html.replace('{{QUIZ_TITLE}}', quiz.title)
    final_html = final_html.replace('{{QUIZ_DESCRIPTION}}', quiz.description or 'Bài kiểm tra trắc nghiệm lý thuyết tin học quốc tế.')
    final_html = final_html.replace('{{QUESTIONS_COUNT}}', str(len(processed_questions)))
    final_html = final_html.replace('{{QUIZ_CSS}}', css_content)
    final_html = final_html.replace('{{QUIZ_JS}}', js_content)

    if not filename:
        file_name = f"Quiz_{quiz.quiz_id}_Standalone.html"
    else:
        if not filename.endswith('.html'):
            file_name = filename + ".html"
        else:
            file_name = filename

    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, file_name)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(final_html)
        
    return file_name
