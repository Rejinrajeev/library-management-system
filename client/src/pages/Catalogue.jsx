import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Catalogue() {
  const { auth } = useAuth();
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [newBook, setNewBook] = useState({ isbn: '', title: '', author: '' });
  const [newCopyCode, setNewCopyCode] = useState('');

  async function load() {
    try {
      setBooks(await api.getBooks(auth.token));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
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
    try {
      await api.createBook(auth.token, newBook);
      setNewBook({ isbn: '', title: '', author: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteBook(id) {
    setError('');
    try {
      await api.deleteBook(auth.token, id);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCopy(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addCopy(auth.token, selected.id, { copyCode: newCopyCode });
      setNewCopyCode('');
      await openBook(selected.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConditionChange(copyId, condition) {
    setError('');
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

        <form className="stacked-form" onSubmit={handleAddBook}>
          <h3>Add a book</h3>
          <input placeholder="ISBN" value={newBook.isbn} onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })} required />
          <input placeholder="Title" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required />
          <input placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} required />
          <button type="submit">Add book</button>
        </form>

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
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Book details</h2>
        {!selected && <p>Select a book to manage its copies.</p>}
        {selected && (
          <>
            <p><strong>{selected.title}</strong> by {selected.author} (ISBN {selected.isbn})</p>
            <button onClick={() => handleDeleteBook(selected.id)}>Delete book</button>

            <h3>Copies</h3>
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

            <form className="stacked-form" onSubmit={handleAddCopy}>
              <h4>Add a copy</h4>
              <input placeholder="Copy code" value={newCopyCode} onChange={(e) => setNewCopyCode(e.target.value)} required />
              <button type="submit">Add copy</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
