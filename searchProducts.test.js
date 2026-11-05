/* globals describe, it, expect */
jest.mock('./resolvers/product', () => ({
  translateProduct: jest.fn(async ({ rootValue }) => ({
    productId: rootValue.pk,
    productName: rootValue.name,
  })),
}));

const Plugin = require('./index');

describe('searchProducts force refresh payload', () => {
  const app = new Plugin({
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    appKey: '00000000-0000-0000-0000-000000000000',
  });
  const token = {
    affiliateKey: '11111111-1111-1111-1111-111111111111',
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    shortName: 'demo-company',
  };

  const search = (items, payload, axios = async ({ url }) => (
    { data: url.endsWith('/items/') ? { items } : { company: {} } }
  )) => app.searchProducts({
    axios,
    token,
    payload,
    typeDefsAndQueries: {},
  });

  it.each([{}, null, undefined])('rejects malformed items %p', async items => {
    const axios = jest.fn().mockResolvedValueOnce({ data: { items } })
      .mockRejectedValueOnce(new Error('company fetch failed'));
    await expect(search(items, undefined, axios)).rejects.toThrow('items array');
    expect(axios).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { pk: '' }, { pk: '  ' }, { pk: NaN }, { pk: Infinity },
    { pk: -Infinity }, { pk: true }])('rejects malformed row %p before fetching company', async row => {
    const items = [{ pk: 1 }, row];
    const axios = jest.fn().mockResolvedValueOnce({ data: { items } });
    await expect(app.searchProducts({ axios, token, typeDefsAndQueries: {} }))
      .rejects.toThrow('row 1 did not return a valid pk');
    expect(axios).toHaveBeenCalledTimes(1);
  });

  it('ignores arbitrary worker metadata while preserving product filters', async () => {
    const items = [{ pk: 42, name: 'Daily Cruise Tour' }, { pk: 43, name: 'Walking Tour' }];
    const metadata = { traceId: 'trace-123', jobId: 'job-456', constructor: 'worker', toString: 'metadata' };
    expect((await search(items, metadata)).products).toHaveLength(2);
    expect((await search(items, { ...metadata, productName: '*Cruise*' })).products)
      .toEqual([{ productId: 42, productName: 'Daily Cruise Tour' }]);
    expect((await search(items, { productName: '*missing*' })).products).toEqual([]);
    expect((await search(items, { productId: '43' })).products)
      .toEqual([{ productId: 43, productName: 'Walking Tour' }]);
    expect((await search(items, { productId: 42 })).products)
      .toEqual([{ productId: 42, productName: 'Daily Cruise Tour' }]);
  });

  it('rejects missing identifiers, deduplicates items, and accepts an empty catalog', async () => {
    await expect(search([{ name: 'invalid' }])).rejects.toThrow('pk');
    expect((await search([{ pk: 1 }, { pk: '1' }, { pk: 2 }])).products)
      .toEqual([{ productId: 1 }, { productId: 2 }]);
    expect((await search([])).products).toEqual([]);
  });

  it('keeps the /items/ catalog when the worker payload includes requestId', async () => {
    const axios = jest.fn(async ({ url }) => {
      if (url.endsWith('/items/')) {
        return { data: { items: [{ pk: 42, name: 'Daily Cruise Tour' }] } };
      }
      return { data: { company: { shortname: 'demo-company' } } };
    });

    const retVal = await app.searchProducts({
      axios,
      token,
      typeDefsAndQueries: {},
      payload: {
        forceRefresh: true,
        requestId: '6f0b6b3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      },
    });

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: 'https://fareharbor.example/api/external/v1/companies/demo-company/items/',
    }));
    expect(retVal.products).toEqual([
      { productId: 42, productName: 'Daily Cruise Tour' },
    ]);
  });
});
