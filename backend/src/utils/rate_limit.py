"""Bộ giới hạn tần suất đơn giản (cửa sổ trượt, lưu trong bộ nhớ của tiến trình).

Dùng cho các endpoint công khai không có đăng nhập (nhập PIN, /api/save-score, /nhan_ip)
để chặn dò mã và gửi dồn dập. Không dùng được để giới hạn qua nhiều tiến trình/máy chủ.
"""
import threading
import time


class SlidingWindowLimiter:
    def __init__(self, max_keys=20000):
        self._events = {}
        self._lock = threading.Lock()
        self._max_keys = max_keys

    def _live(self, key, window, now):
        q = self._events.get(key)
        if not q:
            return []
        q = [t for t in q if now - t < window]
        if q:
            self._events[key] = q
        else:
            self._events.pop(key, None)
        return q

    def _sweep(self, now):
        # Tránh phình bộ nhớ khi có nhiều IP khác nhau: bỏ các khóa im lặng > 1 giờ
        if len(self._events) <= self._max_keys:
            return
        for k in [k for k, q in self._events.items() if not q or now - q[-1] > 3600]:
            self._events.pop(k, None)

    def count(self, key, window):
        now = time.monotonic()
        with self._lock:
            return len(self._live(key, window, now))

    def record(self, key):
        now = time.monotonic()
        with self._lock:
            self._events.setdefault(key, []).append(now)
            self._sweep(now)

    def allow(self, key, limit, window):
        """Ghi nhận 1 lượt; trả về False nếu đã vượt `limit` lượt trong `window` giây."""
        now = time.monotonic()
        with self._lock:
            q = self._live(key, window, now)
            if len(q) >= limit:
                return False
            q.append(now)
            self._events[key] = q
            self._sweep(now)
            return True

    def clear(self, key):
        with self._lock:
            self._events.pop(key, None)

    def reset(self):
        with self._lock:
            self._events.clear()


limiter = SlidingWindowLimiter()
