const { calculateFine } = require('../src/utils/fine');

describe('calculateFine', () => {
  test('no fine when returned before due date', () => {
    expect(calculateFine('2026-01-15', '2026-01-10')).toEqual({ daysLate: 0, fine: 0 });
  });

  test('no fine when returned exactly on due date', () => {
    expect(calculateFine('2026-01-15', '2026-01-15')).toEqual({ daysLate: 0, fine: 0 });
  });

  test('one day late costs Rs 10', () => {
    expect(calculateFine('2026-01-15', '2026-01-16')).toEqual({ daysLate: 1, fine: 10 });
  });

  test('multiple days late accrues Rs 10 per day', () => {
    expect(calculateFine('2026-01-15', '2026-01-20')).toEqual({ daysLate: 5, fine: 50 });
  });

  test('works across month boundaries', () => {
    expect(calculateFine('2026-01-30', '2026-02-02')).toEqual({ daysLate: 3, fine: 30 });
  });

  test('accepts Date objects', () => {
    const due = new Date('2026-03-01T00:00:00Z');
    const ret = new Date('2026-03-04T00:00:00Z');
    expect(calculateFine(due, ret)).toEqual({ daysLate: 3, fine: 30 });
  });
});
