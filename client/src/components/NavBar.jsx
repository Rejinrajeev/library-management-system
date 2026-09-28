import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NavBar() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">Library</Link>
      <div className="nav-links">
        {auth?.user.role === 'member' && (
          <>
            <Link to="/books">Books</Link>
            <Link to="/my-loans">My Loans</Link>
          </>
        )}
        {auth?.user.role === 'librarian' && (
          <>
            <Link to="/catalogue">Catalogue</Link>
            <Link to="/loans">Loans</Link>
            <Link to="/reports">Reports</Link>
          </>
        )}
      </div>
      <div className="nav-right">
        {auth ? (
          <>
            <span className="user-name">{auth.user.name} ({auth.user.role})</span>
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
