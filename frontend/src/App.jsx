import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Import Pages
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Contests from './pages/Contests';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Archive from './pages/Archive';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Departments from './pages/Departments';

function LayoutWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar Header */}
        <Navbar toggleSidebar={toggleSidebar} />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto p-6 focus:outline-none">
          <div className="mx-auto max-w-7xl">
            <Routes>
              {/* Direct Open Portal Routes */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/contests" element={<Contests />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/archive" element={<Archive />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/departments" element={<Departments />} />

              {/* Fallback routing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <Routes>
          {/* Layout Wrapper contains all routes directly */}
          <Route path="/*" element={<LayoutWrapper />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
}

export default App;
