import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FaceEnrollment from './pages/admin/FaceEnrollment';
import Dashboard from './pages/admin/Dashboard';
import AdminLogin from './pages/admin/Login';
import AttendanceScanner from './pages/AttendanceScanner';
import UserReport from './pages/admin/UserReport';
import DTRPage from './pages/admin/DTRPage';
import UserManagement from './pages/admin/UserManagement';
import SettingsPage from './pages/admin/SettingsPage';
import ChangePassword from './pages/admin/ChangePassword';
import AdminLayout from './pages/admin/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthProvider';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AttendanceScanner />} />
          <Route path="/login" element={<AdminLogin />} />
          
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/enroll" element={<FaceEnrollment />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/dtr" element={<DTRPage />} />
            <Route path="/reports" element={<UserReport />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
