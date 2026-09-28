import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Reports() {
  const { auth } = useAuth();
  const [mostBorrowed, setMostBorrowed] = useState([]);
  const [overdueFines, setOverdueFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getMostBorrowed(auth.token), api.getOverdueFines(auth.token)])
      .then(([mb, of]) => {
        setMostBorrowed(mb);
        setOverdueFines(of);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="two-col">
      <div className="card">
        <h2>Most borrowed books (last 30 days)</h2>
        {error && <p className="error">{error}</p>}
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Borrow count</th>
            </tr>
          </thead>
          <tbody>
            {mostBorrowed.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td>{b.author}</td>
                <td>{b.borrow_count}</td>
              </tr>
            ))}
            {mostBorrowed.length === 0 && (
              <tr>
                <td colSpan={3}>No borrows in the last 30 days.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <h2>Members with overdue loans</h2>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Overdue loans</th>
              <th>Total fine (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {overdueFines.map((m) => (
              <tr key={m.member_id}>
                <td>{m.name} ({m.email})</td>
                <td>{m.overdue_loans}</td>
                <td>{m.total_fine}</td>
              </tr>
            ))}
            {overdueFines.length === 0 && (
              <tr>
                <td colSpan={3}>No overdue loans.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
