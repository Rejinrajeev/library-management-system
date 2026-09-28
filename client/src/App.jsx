import { Navigate, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Books from './pages/Books.jsx';
import MyLoans from './pages/MyLoans.jsx';
import Catalogue from './pages/Catalogue.jsx';
import LibrarianLoans from './pages/LibrarianLoans.jsx';
import Reports from './pages/Reports.jsx';

function Home() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  return <Navigate to={auth.user.role === 'librarian' ? '/loans' : '/books'} replace />;
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/books" element={<ProtectedRoute role="member"><Books /></ProtectedRoute>} />
          <Route path="/my-loans" element={<ProtectedRoute role="member"><MyLoans /></ProtectedRoute>} />

          <Route path="/catalogue" element={<ProtectedRoute role="librarian"><Catalogue /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute role="librarian"><LibrarianLoans /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute role="librarian"><Reports /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
