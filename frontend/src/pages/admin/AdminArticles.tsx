import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, BookOpen, Search, Save, X } from 'lucide-react';
import { adminGetArticles, adminCreateArticle, adminUpdateArticle, adminDeleteArticle } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import './css/AdminArticles.css';
import AdminLayout from '../../components/AdminLayout';

interface Article {
  id: number;
  title: string;
  category: string;
  image: string;
  description: string;
  summary: string;
  content: string;
}

const CATEGORIES = ['Word', 'Excel', 'Powerpoint', 'IC3 Spark', 'IC3 GS6'];

const AdminArticles: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  const { modalConfig, showConfirm, closeConfirmModal } = useConfirmModal();

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Word');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await adminGetArticles();
      setArticles(res.data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách bài viết:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedArticle(null);
    setTitle('');
    setCategory('Word');
    setImage('https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=60');
    setDescription('');
    setSummary('');
    setContent('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (art: Article) => {
    setModalMode('edit');
    setSelectedArticle(art);
    setTitle(art.title);
    setCategory(art.category);
    setImage(art.image);
    setDescription(art.description);
    setSummary(art.summary || '');
    setContent(art.content || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!category) {
      setErrorMsg('Vui lòng chọn danh mục bài viết.');
      return;
    }

    const payload = {
      title,
      category,
      image,
      description,
      summary,
      content,
    };

    try {
      if (modalMode === 'create') {
        await adminCreateArticle(payload);
      } else if (selectedArticle) {
        await adminUpdateArticle(selectedArticle.id, payload);
      }
      setIsModalOpen(false);
      fetchArticles();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi lưu bài viết.');
    }
  };

  const handleDelete = (art: Article) => {
    showConfirm(
      'Xóa bài viết kiến thức',
      `Bạn có chắc chắn muốn xóa bài viết "${art.title}"? Thao tác này không thể hoàn tác.`,
      async () => {
        try {
          await adminDeleteArticle(art.id);
          fetchArticles();
        } catch (err) {
          console.error('Lỗi khi xóa bài viết:', err);
        }
      },
      'danger',
      'Xóa vĩnh viễn'
    );
  };

  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === '' || art.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <AdminLayout
        className="admin-articles-page"
        toolbarContent={
          <div className="admin-articles-toolbar-wrapper">
            {/* Filter and Search Bar with inline Create Button */}
            <div className="search-filter-card">
              <div className="search-filter-left">
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="filters-wrapper">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="select-filter-category"
                  >
                    <option value="">Tất cả danh mục</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button className="btn-create-article" onClick={handleOpenCreateModal}>
                <Plus size={18} /> Thêm bài viết mới
              </button>
            </div>
          </div>
        }
        tableContent={
          loading ? (
            <div className="articles-loading-pane flex-center">
              <div className="spinner"></div>
              <p>Đang tải danh sách bài viết...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="empty-articles-pane flex-center">
              <BookOpen className="empty-icon" size={48} />
              <h3>Không tìm thấy bài viết nào</h3>
              <p>Hãy bấm vào nút "Thêm bài viết mới" để tạo nội dung ôn tập.</p>
            </div>
          ) : (
            <div className="admin-articles-grid-scroller">
              <div className="admin-articles-grid">
                {filteredArticles.map(art => (
                  <div key={art.id} className="admin-article-card glass">
                    <div className="card-image-wrapper">
                      <img src={art.image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60'} alt={art.title} />
                      <span className="category-tag-pill">{art.category}</span>
                    </div>
                    <div className="card-body-content">
                      <h3>{art.title}</h3>
                      <p className="card-description-text">{art.description}</p>
                      <div className="card-actions-row">
                        <button className="btn-action-edit" onClick={() => handleOpenEditModal(art)}>
                          <Edit2 size={14} /> Sửa
                        </button>
                        <button className="btn-action-delete" onClick={() => handleDelete(art)}>
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      />

      {/* Confirm Action Dialog */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        mode={modalConfig.mode}
        defaultValue={modalConfig.defaultValue}
        promptPlaceholder={modalConfig.promptPlaceholder}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeConfirmModal}
      />

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="editor-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="editor-modal-content glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title-bar">
              <h2>{modalMode === 'create' ? 'Tạo Bài viết Mới' : 'Chỉnh sửa Bài viết'}</h2>
              <button className="btn-close-editor" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="editor-form-body">
              {errorMsg && <div className="alert-danger-msg">{errorMsg}</div>}
              
              <div className="form-group-row">
                <div className="form-input-block">
                  <label>Tiêu đề bài viết <span className="req">*</span></label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Cách đánh số trang bất kỳ trong Word..."
                    required
                  />
                </div>
                <div className="form-input-block" style={{ maxWidth: '240px' }}>
                  <label>Danh mục <span className="req">*</span></label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-input-block">
                <label>Ảnh đại diện (URL)</label>
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Điền URL hình ảnh (Unsplash, Imgur...)"
                />
              </div>

              <div className="form-input-block">
                <label>Mô tả ngắn (Description) <span className="req">*</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả tóm tắt nội dung bài viết hiển thị ở trang chủ học sinh..."
                  rows={2}
                  required
                />
              </div>

              <div className="form-input-block">
                <label>Tóm tắt các bước (Summary - Hiển thị trên thẻ chính)</label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ví dụ: Bước 1: Tạo Section... Bước 2: Tắt liên kết..."
                />
              </div>

              <div className="form-input-block">
                <label>Chi tiết bài viết (Hỗ trợ mã HTML)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Điền mã HTML các bước thực hành chi tiết. Ví dụ: <h3>Tiêu đề</h3> <ol><li>Bước 1</li></ol>"
                  rows={8}
                />
              </div>

              <div className="editor-modal-footer">
                <button type="button" className="btn-cancel-edit" onClick={() => setIsModalOpen(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-save-submit">
                  <Save size={16} /> Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminArticles;

