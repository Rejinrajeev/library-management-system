import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyLoans() {
  const { auth } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getLoans(auth.token)
      .then(setLoans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="card">
      <h1>My Loans</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Borrowed</th>
            <th>Due</th>
            <th>Returned</th>
            <th>Status</th>
            <th>Fine (Rs)</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id}>
              <td>{l.title}</td>
              <td>{l.borrow_date?.slice(0, 10)}</td>
              <td>{l.due_date?.slice(0, 10)}</td>
              <td>{l.return_date ? l.return_date.slice(0, 10) : '-'}</td>
              <td>{l.return_date ? 'Returned' : l.is_overdue ? 'Overdue' : 'Active'}</td>
              <td>{l.current_fine}</td>
            </tr>
          ))}
          {loans.length === 0 && (
            <tr>
              <td colSpan={6}>No loans yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
