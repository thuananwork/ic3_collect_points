"""Authentication stub for the offline edition (ic3_collect_points).

Provides a single built-in local teacher who has all permissions.
"""

class LocalTeacher:
    id = 1
    user_id = 1
    name = "Giáo viên"
    username = "teacher"
    email = "teacher@ic3.local"
    role = "teacher"
    is_authenticated = True
    is_active = True
    is_anonymous = False
    approved = True
    is_approved = True

    def get_id(self):
        return str(self.id)

    def has_permission(self, permission=None):
        return True

    @property
    def permissions(self):
        return [
            'all',
            'choose_class', 'chonlop',
            'get_scores', 'laydiem',
            'manage_seating', 'chongoi',
            'set_target', 'muctieu',
            'nhan_diem_thuc_hanh',
            'cong_cu_tien_ich',
            'trac_nghiem_ly_thuyet',
            'bai_giang_dien_tu',
            'tai_lieu_on_tap',
            'manage_gsheet', 'scoreboard',
            'excel_mode', 'excel-mode'
        ]

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "permissions": self.permissions,
        }

    def __call__(self):
        return self

    def __int__(self):
        return self.id

    def __str__(self):
        return self.name


_stub_teacher = LocalTeacher()


def current_user():
    return _stub_teacher


# Attach attributes to current_user function so that both current_user.attr and current_user().attr work seamlessly
for _attr in [
    'id', 'user_id', 'name', 'username', 'email', 'role',
    'is_authenticated', 'is_active', 'is_anonymous', 'approved', 'is_approved',
    'permissions', 'has_permission', 'get_id', 'to_dict'
]:
    setattr(current_user, _attr, getattr(_stub_teacher, _attr))
