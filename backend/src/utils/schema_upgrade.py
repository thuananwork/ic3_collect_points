"""Tự bổ sung các cột mới vào CSDL cũ khi khởi động (an toàn chạy nhiều lần)."""
from sqlalchemy import inspect, text

# (bảng, cột, kiểu SQL)
NEW_COLUMNS = []


def ensure_schema(engine):
    try:
        insp = inspect(engine)
        for table, column, sql_type in NEW_COLUMNS:
            if not insp.has_table(table):
                continue
            if column in {c['name'] for c in insp.get_columns(table)}:
                continue
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD {column} {sql_type} NULL'))
            print(f'[*] Đã thêm cột {table}.{column}')
    except Exception as exc:
        print(f'[!] Không nâng cấp được schema: {exc}')
