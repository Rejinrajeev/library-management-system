import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';

const EMPTY_NEW_BOOK = { isbn: '', title: '', author: '', numberOfCopies: '1', copyCondition: 'good', copyCodePrefix: '' };

export default function Catalogue() {
  const { auth } = useAuth();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newBook, setNewBook] = useState(EMPTY_NEW_BOOK);
  const [newCopyCode, setNewCopyCode] = useState('');
  const [savingBook, setSavingBook] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [deletingBook, setDeletingBook] = useState(false);

  async function load(targetPage = page) {
    setLoading(true);
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

  async function openBook(id) {
    setError('');
    try {
      setSelected(await api.getBook(auth.token, id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddBook(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const isbn = newBook.isbn.trim();
    const title = newBook.title.trim();
    const author = newBook.author.trim();
    if (!isbn || !title || !author) {
      setError('ISBN, title and author are required.');
      return;
    }
    if (isbn.replace(/[\s-]/g, '').length < 13 || !/^[\d\s-]+$/.test(isbn)) {
      setError('ISBN must contain at least 13 digits.');
      return;
    }
    const numberOfCopies = Number(newBook.numberOfCopies);
    if (!Number.isInteger(numberOfCopies) || numberOfCopies < 0 || numberOfCopies > 100) {
      setError('Number of copies must be a whole number between 0 and 100.');
      return;
    }

    setSavingBook(true);
    try {
      await api.createBook(auth.token, {
        isbn,
        title,
        author,
        numberOfCopies,
        copyCondition: newBook.copyCondition,
        copyCodePrefix: newBook.copyCodePrefix.trim(),
      });
      setNewBook(EMPTY_NEW_BOOK);
      setMessage(`"${title}" added.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBook(false);
    }
  }

  async function handleDeleteBook(id, title) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError('');
    setMessage('');
    setDeletingBook(true);
    try {
      await api.deleteBook(auth.token, id);
      setSelected(null);
      setMessage(`"${title}" deleted.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingBook(false);
    }
  }

  async function handleAddCopy(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const copyCode = newCopyCode.trim();
    if (!copyCode) {
      setError('Copy code is required.');
      return;
    }

    setSavingCopy(true);
    try {
      await api.addCopy(auth.token, selected.id, { copyCode });
      setNewCopyCode('');
      setMessage(`Copy "${copyCode}" added.`);
      await openBook(selected.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCopy(false);
    }
  }

  async function handleConditionChange(copyId, condition) {
    setError('');
    setMessage('');
    try {
      await api.updateCopy(auth.token, copyId, condition);
      await openBook(selected.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="two-col">
      <div className="card">
        <h1>Catalogue</h1>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <form className="stacked-form" onSubmit={handleAddBook}>
          <h3>Add a book</h3>
          <input
            placeholder="ISBN (at least 13 digits)"
            value={newBook.isbn}
            onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
            maxLength={32}
            required
          />
          <input
            placeholder="Title"
            value={newBook.title}
            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
            maxLength={200}
            required
          />
          <input
            placeholder="Author"
            value={newBook.author}
            onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
            maxLength={200}
            required
          />
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="Number of copies"
            value={newBook.numberOfCopies}
            onChange={(e) => setNewBook({ ...newBook, numberOfCopies: e.target.value })}
            required
          />
          <input
            placeholder="Copy code prefix (optional, defaults to ISBN)"
            value={newBook.copyCodePrefix}
            onChange={(e) => setNewBook({ ...newBook, copyCodePrefix: e.target.value })}
            maxLength={50}
          />
          <select
            value={newBook.copyCondition}
            onChange={(e) => setNewBook({ ...newBook, copyCondition: e.target.value })}
          >
            <option value="good">good</option>
            <option value="damaged">damaged</option>
            <option value="lost">lost</option>
          </select>
          <button type="submit" disabled={savingBook}>{savingBook ? 'Adding...' : 'Add book'}</button>
        </form>

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

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.available_copies} / {b.total_copies}</td>
                  <td>
                    <button onClick={() => openBook(b.id)}>Manage</button>
                  </td>
                </tr>
              ))}
              {books.length === 0 && (
                <tr>
                  <td colSpan={3}>No books found.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onChange={load} />
          </>
        )}
      </div>

      <div className="card">
        <h2>Book details</h2>
        {!selected && <p>Select a book to manage its copies.</p>}
        {selected && (
          <>
            <p><strong>{selected.title}</strong> by {selected.author} (ISBN {selected.isbn})</p>
            <button disabled={deletingBook} onClick={() => handleDeleteBook(selected.id, selected.title)}>
              {deletingBook ? 'Deleting...' : 'Delete book'}
            </button>

            <h3>Copies</h3>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Copy code</th>
                  <th>Condition</th>
                  <th>On loan</th>
                </tr>
              </thead>
              <tbody>
                {selected.copies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.copy_code}</td>
                    <td>
                      <select value={c.condition} onChange={(e) => handleConditionChange(c.id, e.target.value)} disabled={c.on_loan}>
                        <option value="good">good</option>
                        <option value="damaged">damaged</option>
                        <option value="lost">lost</option>
                      </select>
                    </td>
                    <td>{c.on_loan ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <form className="stacked-form" onSubmit={handleAddCopy}>
              <h4>Add a copy</h4>
              <input
                placeholder="Copy code"
                value={newCopyCode}
                onChange={(e) => setNewCopyCode(e.target.value)}
                maxLength={50}
                required
              />
              <button type="submit" disabled={savingCopy}>{savingCopy ? 'Adding...' : 'Add copy'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
