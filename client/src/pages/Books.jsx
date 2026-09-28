import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';

export default function Books() {
  const { auth } = useAuth();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load(targetPage = page) {
    setLoading(true);
    setError('');
    try {
      const data = await api.getBooks(auth.token, { search, page: targetPage });
      setBooks(data.books);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBorrow(bookId) {
    setMessage('');
    setError('');
    setBusyId(bookId);
    try {
      await api.borrowBook(auth.token, bookId);
      setMessage('Book borrowed successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReserve(bookId) {
    setMessage('');
    setError('');
    setBusyId(bookId);
    try {
      await api.reserveBook(auth.token, bookId);
      setMessage('Reserved. You will get the next available copy once it is returned.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h1>Books</h1>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          load(1);
        }}
      >
        <input placeholder="Search by title, author or ISBN" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>ISBN</th>
              <th>Available</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td>{b.author}</td>
                <td>{b.isbn}</td>
                <td>{b.available_copies} / {b.total_copies}</td>
                <td>
                  {b.available_copies > 0 ? (
                    <button disabled={busyId === b.id} onClick={() => handleBorrow(b.id)}>
                      {busyId === b.id ? 'Borrowing...' : 'Borrow'}
                    </button>
                  ) : (
                    <button disabled={busyId === b.id} onClick={() => handleReserve(b.id)}>
                      {busyId === b.id ? 'Reserving...' : 'Reserve'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {books.length === 0 && (
              <tr>
                <td colSpan={5}>No books found.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onChange={load} />
        </>
      )}
    </div>
  );
}
