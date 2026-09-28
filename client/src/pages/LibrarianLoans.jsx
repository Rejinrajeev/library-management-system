import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Returned' },
];

export default function LibrarianLoans() {
  const { auth } = useAuth();
  const [loans, setLoans] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [conditionById, setConditionById] = useState({});

  async function load() {
    setError('');
    try {
      setLoans(await api.getLoans(auth.token, status ? { status } : {}));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleReturn(loanId) {
    setError('');
    setBusyId(loanId);
    const condition = conditionById[loanId] || 'good';
    try {
      await api.returnLoan(auth.token, loanId, condition);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h1>Loans</h1>
      <div className="search-row">
        {STATUS_OPTIONS.map((opt) => (
          <button key={opt.value} className={status === opt.value ? 'active' : ''} onClick={() => setStatus(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>Copy</th>
              <th>Member</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Status</th>
              <th>Fine (Rs)</th>
              <th>Return</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td>{l.title}</td>
                <td>{l.copy_code}</td>
                <td>{l.member_name}</td>
                <td>{l.borrow_date?.slice(0, 10)}</td>
                <td>{l.due_date?.slice(0, 10)}</td>
                <td>{l.return_date ? 'Returned' : l.is_overdue ? 'Overdue' : 'Active'}</td>
                <td>{l.current_fine}</td>
                <td>
                  {!l.return_date && (
                    <div className="return-controls">
                      <select
                        value={conditionById[l.id] || 'good'}
                        onChange={(e) => setConditionById({ ...conditionById, [l.id]: e.target.value })}
                      >
                        <option value="good">good</option>
                        <option value="damaged">damaged</option>
                        <option value="lost">lost</option>
                      </select>
                      <button disabled={busyId === l.id} onClick={() => handleReturn(l.id)}>
                        {busyId === l.id ? 'Processing...' : 'Return'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={8}>No loans found.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
