import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Placeholder from './pages/Placeholder.jsx';
import { Protected } from './AuthContext.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Rfid from './pages/Rfid.jsx';
import TripPlanner from './pages/TripPlanner.jsx';
import TripHistory from './pages/TripHistory.jsx';
import TripDetail from './pages/TripDetail.jsx';
import Profile from './pages/Profile.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/vehicles" element={<Protected><Vehicles /></Protected>} />
      <Route path="/admin/dashboard" element={<Protected role="admin"><Placeholder /></Protected>} />
      <Route path="/rfid" element={<Protected><Rfid /></Protected>} />
      <Route path="/trip-planner" element={<Protected><TripPlanner /></Protected>} />
      <Route path="/trip-history" element={<Protected><TripHistory /></Protected>} />
      <Route path="/trip-history/:id" element={<Protected><TripDetail /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      {/* Pages not built yet (admin pages) */}
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
