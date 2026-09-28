import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyLoans() {
  const { auth } = useAuth();
  const [loans, setLoans] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getLoans(auth.token), api.getReservations(auth.token)])
      .then(([loanData, reservationData]) => {
        setLoans(loanData);
        setReservations(reservationData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return <p>Loading...</p>;

  const waitingReservations = reservations.filter((r) => !r.fulfilled_at);

  return (
    <>
      <div className="card">
        <h1>My Loans</h1>
        {error && <p className="error">{error}</p>}
        <div className="table-scroll">
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
      </div>

      <div className="card">
        <h2>My Reservations</h2>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Reserved on</th>
              <th>Queue position</th>
            </tr>
          </thead>
          <tbody>
            {waitingReservations.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.created_at?.slice(0, 10)}</td>
                <td>{r.queue_position}</td>
              </tr>
            ))}
            {waitingReservations.length === 0 && (
              <tr>
                <td colSpan={3}>No active reservations.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
