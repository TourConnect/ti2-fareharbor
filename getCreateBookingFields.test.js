/* globals describe, it, expect */
const Plugin = require('./index');

describe('getCreateBookingFields', () => {
  const app = new Plugin({
    jwtKey: 'test-jwt-key',
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    appKey: '00000000-0000-0000-0000-000000000000',
  });

  const token = {
    affiliateKey: '11111111-1111-1111-1111-111111111111',
    appKey: '00000000-0000-0000-0000-000000000000',
    endpoint: 'https://fareharbor.example/api/external/v1/companies',
    shortName: 'demo-company',
  };

  it('returns required/visible flags for booking and participant scoped fields', async () => {
    const axios = jest.fn()
      .mockResolvedValueOnce({
        data: {
          availabilities: [{
            pk: 9001,
            customer_type_rates: [{ pk: 1 }],
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          availability: {
            custom_field_instances: [
              {
                custom_field: {
                  pk: 101,
                  name: 'Dietary notes',
                  title: 'Dietary notes',
                  type: 'long',
                  description: '',
                  is_required: true,
                  is_always_per_customer: false,
                  extended_options: [],
                },
              },
              {
                custom_field: {
                  pk: 102,
                  name: 'Emergency contact',
                  title: 'Emergency contact',
                  type: 'short',
                  description: '',
                  is_required: true,
                  is_always_per_customer: true,
                  extended_options: [],
                },
              },
            ],
            customer_type_rates: [
              {
                customer_prototype: { pk: 777 },
                custom_field_instances: [
                  {
                    custom_field: {
                      pk: 201,
                      name: 'Shoe size',
                      title: 'Shoe size',
                      type: 'short',
                      description: '',
                      is_required: false,
                      is_always_per_customer: false,
                      extended_options: [],
                    },
                  },
                ],
              },
            ],
          },
        },
      });

    const result = await app.getCreateBookingFields({
      axios,
      token,
      query: {
        productId: 32439,
        date: '15/08/2026',
        dateFormat: 'DD/MM/YYYY',
      },
    });

    expect(result.fields).toEqual([]);
    expect(result.customFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '101',
        requiredPerBooking: true,
        requiredPerParticipant: false,
        visiblePerBooking: true,
        visiblePerParticipant: false,
      }),
      expect.objectContaining({
        id: '102',
        requiredPerBooking: false,
        requiredPerParticipant: true,
        visiblePerBooking: true,
        visiblePerParticipant: true,
      }),
      expect.objectContaining({
        id: '201',
        requiredPerBooking: false,
        requiredPerParticipant: false,
        visiblePerBooking: true,
        visiblePerParticipant: true,
        isPerUnitItem: true,
        unitId: 777,
      }),
    ]));
    expect(axios).toHaveBeenCalledTimes(2);
  });

  it('returns empty response when productId is missing', async () => {
    const axios = jest.fn();
    const result = await app.getCreateBookingFields({
      axios,
      token,
      query: {
        date: '15/08/2026',
        dateFormat: 'DD/MM/YYYY',
      },
    });
    expect(result).toEqual({ fields: [], customFields: [] });
    expect(axios).not.toHaveBeenCalled();
  });
});
