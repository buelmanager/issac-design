import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-logo">issac.design</div>
          <div className="admin-login-subtitle">관리자 로그인</div>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          {error && <div className="admin-login-error">{error}</div>}

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-email">
              이메일
            </label>
            <input
              id="admin-email"
              className="admin-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@issac.design"
              required
              autoComplete="email"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-password">
              비밀번호
            </label>
            <input
              id="admin-password"
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              autoComplete="current-password"
            />
          </div>

          <button className="admin-login-btn" type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
