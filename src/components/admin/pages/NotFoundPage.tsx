import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="admin-placeholder">
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다.</p>
      <Link to="/" className="admin-btn admin-btn-primary" style={{ marginTop: 16 }}>
        Dashboard로 돌아가기
      </Link>
    </div>
  );
}
