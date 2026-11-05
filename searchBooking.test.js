/* globals describe, it, expect */
jest.mock('./resolvers/booking', () => ({
  translateBooking: jest.fn(async ({ rootValue }) => ({
    bookingId: rootValue.uuid,
    supplierBookingId: rootValue.display_id,
  })),
}));

const Plugin = require('./index');

const UUID_A = '4509eb05-79cb-405d-8aba-e1d0edaef309';
const UUID_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('searchBooking', () => {
  const app = new Plugin({
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    appKey: '00000000-0000-0000-0000-000000000000',
  });
  const token = {
    affiliateKey: '11111111-1111-1111-1111-111111111111',
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    shortName: 'demo-company',
  };

  const search = (payload, axios) => app.searchBooking({
    axios,
    token,
    payload,
    typeDefsAndQueries: {},
  });

  it('fetches a single booking by UUID', async () => {
    const axios = jest.fn(async ({ url }) => {
      expect(url).toBe(`https://fareharbor.example/api/external/v1/companies/demo-company/bookings/${UUID_A}/`);
      return { data: { booking: { uuid: UUID_A, display_id: '#1' } } };
    });
    await expect(search({ bookingId: UUID_A }, axios))
      .resolves.toEqual({ bookings: [{ bookingId: UUID_A, supplierBookingId: '#1' }] });
  });

  it('returns an empty list for a non-UUID bookingId without calling FareHarbor', async () => {
    const axios = jest.fn();
    await expect(search({ bookingId: '#344488' }, axios)).resolves.toEqual({ bookings: [] });
    expect(axios).not.toHaveBeenCalled();
  });

  it('returns an empty list when FareHarbor rejects the UUID', async () => {
    const axios = jest.fn(async () => {
      const err = new Error('Request failed with status code 404');
      err.response = { status: 404, data: { error: `'${UUID_B}' is not a valid booking uuid for company shortname 'demo-company'` } };
      throw err;
    });
    await expect(search({ bookingId: UUID_B }, axios)).resolves.toEqual({ bookings: [] });
  });

  it('rejects criteria FareHarbor cannot search directly', async () => {
    const axios = jest.fn();
    await expect(search({}, axios)).rejects.toThrow('at least one of bookingId');
    await expect(search({ supplierBookingId: '#344488' }, axios))
      .rejects.toThrow('supplierBookingId/resellerReference search is not supported');
    await expect(search({ resellerReference: 'voucher-1' }, axios))
      .rejects.toThrow('supplierBookingId/resellerReference search is not supported');
    expect(axios).not.toHaveBeenCalled();
  });

  it('rejects reference selectors even when a date range is supplied', async () => {
    const axios = jest.fn();
    await expect(search({
      supplierBookingId: '#344488',
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
    }, axios)).rejects.toThrow('supplierBookingId/resellerReference search is not supported');
    await expect(search({
      resellerReference: 'voucher-1',
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
    }, axios)).rejects.toThrow('supplierBookingId/resellerReference search is not supported');
    expect(axios).not.toHaveBeenCalled();
  });

  it('does not swallow non-404 upstream failures whose message mentions not found', async () => {
    const axios = jest.fn(async () => {
      const err = new Error('Request failed with status code 500');
      err.response = { status: 500, data: { error: 'Booking lookup not found in upstream cache' } };
      throw err;
    });
    await expect(search({ bookingId: UUID_A }, axios)).rejects.toThrow('status code 500');
  });

  it('fails visibly on malformed list responses instead of returning empty results', async () => {
    const emptyData = jest.fn(async () => ({ data: {} }));
    await expect(search({
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
    }, emptyData)).rejects.toThrow('did not return a bookings array');
    await expect(search({
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
    }, emptyData)).rejects.toThrow('did not return a items array');
  });

  it('fails visibly on a malformed availabilities list', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }] } };
      return { data: {} };
    });
    await expect(search({
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
    }, axios)).rejects.toThrow('did not return a availabilities array');
  });

  it('fails visibly on a malformed availability bookings list', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }] } };
      if (url.includes('/minimal/availabilities/date-range/')) {
        return { data: { availabilities: [{ pk: 201 }] } };
      }
      return { data: {} };
    });
    await expect(search({
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
    }, axios)).rejects.toThrow('availability bookings response did not return a bookings array');
  });

  it('fails visibly on rows missing PKs or UUIDs in the travel search path', async () => {
    const travelPayload = {
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
    };
    const itemWithoutPk = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ name: 'Daily Cruise Tour' }] } };
      throw new Error(`unexpected url ${url}`);
    });
    await expect(search(travelPayload, itemWithoutPk))
      .rejects.toThrow('returned an item without a pk');

    const availabilityWithoutPk = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }] } };
      if (url.includes('/minimal/availabilities/date-range/')) {
        return { data: { availabilities: [{ start_at: '2022-08-18T12:00:00+1000' }] } };
      }
      throw new Error(`unexpected url ${url}`);
    });
    await expect(search(travelPayload, availabilityWithoutPk))
      .rejects.toThrow('returned an availability without a pk');

    const bookingWithoutUuid = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }] } };
      if (url.includes('/minimal/availabilities/date-range/')) {
        return { data: { availabilities: [{ pk: 201 }] } };
      }
      if (url.endsWith('/availabilities/201/bookings/')) {
        return { data: { bookings: [{ pk: 344488 }] } };
      }
      throw new Error(`unexpected url ${url}`);
    });
    await expect(search(travelPayload, bookingWithoutUuid))
      .rejects.toThrow('returned a booking without a uuid');
  });

  it('fails visibly on a purchase-date booking row missing a UUID', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.includes('/minimal/bookings-by-create-date/')) {
        return { data: { bookings: [{ pk: 344488 }] } };
      }
      throw new Error(`unexpected url ${url}`);
    });
    await expect(search({
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
    }, axios)).rejects.toThrow('returned a booking without a uuid');
  });

  it('fails visibly when a listed candidate has no booking detail object', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.includes('/minimal/bookings-by-create-date/')) {
        return { data: { bookings: [{ uuid: UUID_A }] } };
      }
      return { data: {} };
    });
    await expect(search({
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
    }, axios)).rejects.toThrow('did not return a booking object');
  });

  it('rejects dates that do not strictly match dateFormat', async () => {
    const axios = jest.fn();
    await expect(search({
      purchaseDateStart: '2022-08-01garbage',
      purchaseDateEnd: '2022-08-02',
      dateFormat: 'YYYY-MM-DD',
    }, axios)).rejects.toThrow('invalid search date');
    expect(axios).not.toHaveBeenCalled();
  });

  it('searches by purchase date range, iterating bookings-by-create-date per day', async () => {
    const requestedUrls = [];
    const axios = jest.fn(async ({ url }) => {
      requestedUrls.push(url);
      if (url.includes('/minimal/bookings-by-create-date/2022-08-01/')) {
        return { data: { bookings: [{ uuid: UUID_A }] } };
      }
      if (url.includes('/minimal/bookings-by-create-date/2022-08-02/')) {
        // UUID_A created again in the range is deduplicated.
        return { data: { bookings: [{ uuid: UUID_A }, { uuid: UUID_B }] } };
      }
      if (url.endsWith(`/bookings/${UUID_A}/`)) return { data: { booking: { uuid: UUID_A } } };
      if (url.endsWith(`/bookings/${UUID_B}/`)) return { data: { booking: { uuid: UUID_B } } };
      throw new Error(`unexpected url ${url}`);
    });
    const result = await search({
      purchaseDateStart: '2022-08-01',
      purchaseDateEnd: '2022-08-02',
      dateFormat: 'YYYY-MM-DD',
    }, axios);
    expect(result.bookings.map(b => b.bookingId)).toEqual([UUID_A, UUID_B]);
    expect(requestedUrls.filter(u => u.includes('bookings-by-create-date'))).toHaveLength(2);
  });

  it('honours dateFormat when parsing purchase dates', async () => {
    const requestedUrls = [];
    const axios = jest.fn(async ({ url }) => {
      requestedUrls.push(url);
      if (url.includes('/minimal/bookings-by-create-date/')) return { data: { bookings: [] } };
      throw new Error(`unexpected url ${url}`);
    });
    await expect(search({
      purchaseDateStart: '01/08/2022',
      purchaseDateEnd: '02/08/2022',
      dateFormat: 'DD/MM/YYYY',
    }, axios)).resolves.toEqual({ bookings: [] });
    expect(requestedUrls).toEqual([
      'https://fareharbor.example/api/external/v1/companies/demo-company/minimal/bookings-by-create-date/2022-08-01/',
      'https://fareharbor.example/api/external/v1/companies/demo-company/minimal/bookings-by-create-date/2022-08-02/',
    ]);
  });

  it('searches by travel date range via items, availabilities and their bookings', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }, { pk: 102 }] } };
      if (url.includes('/items/101/minimal/availabilities/date-range/2022-08-18/2022-08-19/')) {
        return { data: { availabilities: [{ pk: 201 }] } };
      }
      if (url.includes('/items/102/minimal/availabilities/date-range/2022-08-18/2022-08-19/')) {
        return { data: { availabilities: [{ pk: 202 }] } };
      }
      if (url.endsWith('/availabilities/201/bookings/')) return { data: { bookings: [{ uuid: UUID_A }] } };
      if (url.endsWith('/availabilities/202/bookings/')) return { data: { bookings: [{ uuid: UUID_B }] } };
      if (url.endsWith(`/bookings/${UUID_A}/`)) return { data: { booking: { uuid: UUID_A } } };
      if (url.endsWith(`/bookings/${UUID_B}/`)) return { data: { booking: { uuid: UUID_B } } };
      throw new Error(`unexpected url ${url}`);
    });
    const result = await search({
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-19',
      dateFormat: 'YYYY-MM-DD',
    }, axios);
    expect(result.bookings.map(b => b.bookingId)).toEqual([UUID_A, UUID_B]);
  });

  it('intersects purchase and travel date results when both are given', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.includes('/minimal/bookings-by-create-date/')) {
        return { data: { bookings: [{ uuid: UUID_A }, { uuid: UUID_B }] } };
      }
      if (url.endsWith('/items/')) return { data: { items: [{ pk: 101 }] } };
      if (url.includes('/minimal/availabilities/date-range/')) {
        return { data: { availabilities: [{ pk: 201 }] } };
      }
      if (url.endsWith('/availabilities/201/bookings/')) return { data: { bookings: [{ uuid: UUID_B }] } };
      if (url.endsWith(`/bookings/${UUID_B}/`)) return { data: { booking: { uuid: UUID_B } } };
      throw new Error(`unexpected url ${url}`);
    });
    const result = await search({
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
      travelDateStart: '2022-08-18',
      travelDateEnd: '2022-08-18',
      dateFormat: 'YYYY-MM-DD',
    }, axios);
    expect(result.bookings.map(b => b.bookingId)).toEqual([UUID_B]);
  });

  it('skips candidates that disappear before the full booking fetch', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.includes('/minimal/bookings-by-create-date/')) {
        return { data: { bookings: [{ uuid: UUID_A }, { uuid: UUID_B }] } };
      }
      if (url.endsWith(`/bookings/${UUID_A}/`)) return { data: { booking: { uuid: UUID_A } } };
      if (url.endsWith(`/bookings/${UUID_B}/`)) {
        const err = new Error('Request failed with status code 404');
        err.response = { status: 404, data: { error: 'not found' } };
        throw err;
      }
      throw new Error(`unexpected url ${url}`);
    });
    const result = await search({
      purchaseDateStart: '2022-08-02',
      purchaseDateEnd: '2022-08-02',
      dateFormat: 'YYYY-MM-DD',
    }, axios);
    expect(result.bookings.map(b => b.bookingId)).toEqual([UUID_A]);
  });
});
