import React from 'react';
import './css/AdminLayout.css';

interface AdminLayoutProps {
  className?: string;
  sidebarContent?: React.ReactNode;
  toolbarContent?: React.ReactNode;
  tableContent?: React.ReactNode;
  detailContent?: React.ReactNode;
  isDetailCollapsed?: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  className = '',
  sidebarContent,
  toolbarContent,
  tableContent,
  detailContent,
  isDetailCollapsed = true,
}) => {
  return (
    <div className={`admin-layout-container ${className}`}>
      {/* 1. LEFT SIDEBAR */}
      {sidebarContent && (
        <aside className="admin-layout-sidebar">
          {sidebarContent}
        </aside>
      )}

      {/* 2. CENTRAL MAIN CONTENT */}
      <main className="admin-layout-main-content">
        <div className="admin-layout-card-box">
          {/* Top part: Toolbar */}
          {toolbarContent && (
            <section className="admin-layout-toolbar">
              {toolbarContent}
            </section>
          )}

          {/* Sleek Thin Divider Line */}
          {toolbarContent && tableContent && (
            <div className="admin-layout-divider" />
          )}

          {/* Bottom part: Table or Main List */}
          {tableContent && (
            <section className="admin-layout-table-card">
              {tableContent}
            </section>
          )}
        </div>
      </main>

      {/* 3. RIGHT DETAIL PANEL */}
      {detailContent && (
        <aside className={`admin-layout-detail-panel ${isDetailCollapsed ? 'collapsed' : ''}`}>
          {detailContent}
        </aside>
      )}
    </div>
  );
};

export default AdminLayout;
