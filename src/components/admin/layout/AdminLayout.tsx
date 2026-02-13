import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
