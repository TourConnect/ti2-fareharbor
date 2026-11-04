const Plugin = require('./index');
const { typeDefs: availTypeDefs, query: availQuery } = require('ti2/controllers/graphql-schemas/availability');

test.each([true, false, undefined])('calendar requests detailed rates only when enabled: %s', async includeUnitRates => {
  const axios = jest.fn(async ({ url }) => ({ data: { availabilities: [{
    start_at: '2026-11-21T10:30:00+1100',
    ...(url.includes('?detailed=yes') ? {
      customer_type_rates: [{ customer_prototype: { pk: 1477539, total_including_tax: 2500 } }],
    } : {}),
  }] } }));
  const app = new Plugin({ endpoint: 'https://fareharbor.example/companies' });
  const result = await app.availabilityCalendar({
    axios, token: { shortName: 'rockswalkingtours' },
    payload: { includeUnitRates, productIds: ['66312'], optionIds: ['default'],
      startDate: '2026-11-21', endDate: '2026-11-21', dateFormat: 'YYYY-MM-DD' },
    typeDefsAndQueries: { availTypeDefs, availQuery },
  });
  expect(axios.mock.calls[0][0].url).toBe(
    `https://fareharbor.example/companies/rockswalkingtours/items/66312/minimal/availabilities/date-range/2026-11-21/2026-11-21/${includeUnitRates ? '?detailed=yes' : ''}`,
  );
  const availability = result.availability[0][0];
  expect(availability.dateTimeStart).toBe('2026-11-21T10:30:00+1100');
  if (includeUnitRates) {
    expect(availability.unitPricing).toEqual([expect.objectContaining({ unitId: '1477539', retail: 2500 })]);
    expect(availability.pricing).toEqual(expect.objectContaining({ unitId: '1477539', retail: 2500 }));
  } else {
    expect(availability.unitPricing).toBeNull();
    expect(availability.pricing).toBeNull();
  }
});
