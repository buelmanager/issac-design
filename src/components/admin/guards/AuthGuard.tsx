import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="admin-spinner admin-spinner-fullpage" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
