const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const copyRoutes = require('./routes/copies');
const loanRoutes = require('./routes/loans');
const reservationRoutes = require('./routes/reservations');
const reportRoutes = require('./routes/reports');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/copies', copyRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
