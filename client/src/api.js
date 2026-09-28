const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || 'Something went wrong.';
    throw new Error(message);
  }
  return data;
}

export const api = {
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),

  getBooks: (token, { search, page = 1, pageSize = 10 } = {}) => {
    const params = new URLSearchParams({ page, pageSize });
    if (search) params.set('search', search);
    return request(`/books?${params.toString()}`, { token });
  },
  getBook: (token, id) => request(`/books/${id}`, { token }),
  createBook: (token, book) => request('/books', { method: 'POST', body: book, token }),
  updateBook: (token, id, book) => request(`/books/${id}`, { method: 'PUT', body: book, token }),
  deleteBook: (token, id) => request(`/books/${id}`, { method: 'DELETE', token }),
  addCopy: (token, bookId, copy) => request(`/books/${bookId}/copies`, { method: 'POST', body: copy, token }),
  updateCopy: (token, id, condition) => request(`/copies/${id}`, { method: 'PUT', body: { condition }, token }),
  deleteCopy: (token, id) => request(`/copies/${id}`, { method: 'DELETE', token }),

  getLoans: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/loans${qs ? `?${qs}` : ''}`, { token });
  },
  borrowBook: (token, bookId) => request('/loans', { method: 'POST', body: { bookId }, token }),
  returnLoan: (token, loanId, condition) => request(`/loans/${loanId}/return`, { method: 'POST', body: { condition }, token }),

  getReservations: (token) => request('/reservations', { token }),
  reserveBook: (token, bookId) => request('/reservations', { method: 'POST', body: { bookId }, token }),

  getMostBorrowed: (token) => request('/reports/most-borrowed', { token }),
  getOverdueFines: (token) => request('/reports/overdue-fines', { token }),
};
