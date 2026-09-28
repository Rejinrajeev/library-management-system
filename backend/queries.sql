-- Q1: The 5 most borrowed books in the last 30 days.
SELECT b.id, b.title, b.author, COUNT(*) AS borrow_count
FROM loans l
JOIN copies c ON c.id = l.copy_id
JOIN books b ON b.id = c.book_id
WHERE l.borrow_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.title, b.author
ORDER BY borrow_count DESC
LIMIT 5;

-- Q2: Members with overdue loans, and the total fine each would owe if returned today.
SELECT u.id AS member_id, u.name, u.email,
       COUNT(*) AS overdue_loans,
       SUM((CURRENT_DATE - l.due_date) * 10) AS total_fine
FROM loans l
JOIN users u ON u.id = l.member_id
WHERE l.return_date IS NULL AND l.due_date < CURRENT_DATE
GROUP BY u.id, u.name, u.email
ORDER BY total_fine DESC;
