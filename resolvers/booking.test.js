/* globals describe, it, expect */
const { typeDefs, query } = require('ti2/controllers/graphql-schemas/booking');
const { translateBooking } = require('./booking');
const rawBooking = require('../__fixtures__/raw-booking');

describe('translateBooking', () => {
  it('maps bookingDate from the FareHarbor created_at field', async () => {
    const booking = await translateBooking({
      rootValue: { ...rawBooking, created_at: '2022-08-02T01:14:05+0000' },
      typeDefs,
      query,
    });
    expect(booking.bookingDate).toBe('2022-08-02T01:14:05+0000');
  });

  it('falls back to utcCreatedAt when created_at is absent', async () => {
    const booking = await translateBooking({
      rootValue: { ...rawBooking, utcCreatedAt: '2022-08-03T01:14:05+0000' },
      typeDefs,
      query,
    });
    expect(booking.bookingDate).toBe('2022-08-03T01:14:05+0000');
  });
});
