/* globals describe, it, expect, beforeEach */
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('./resolvers/booking', () => ({
  translateBooking: jest.fn(async ({ rootValue }) => rootValue),
}));

const jwt = require('jsonwebtoken');
const Plugin = require('./index');

describe('createBooking custom fields mapping', () => {
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

  beforeEach(() => {
    jwt.verify.mockReset();
  });

  it('routes non-unit participant fields to booking and unit fields to customers', async () => {
    jwt.verify.mockResolvedValue({
      availabilityId: 79961022,
      customers: [
        { customer_type_rate: 2648213465 },
        { customer_type_rate: 2648213465 },
      ],
    });
    const axios = jest.fn().mockResolvedValue({
      data: { booking: { pk: 1234 } },
    });

    await app.createBooking({
      axios,
      token,
      payload: {
        availabilityKey: 'fake',
        holder: {
          name: 'Sachin',
          surname: 'Shintre',
          emailAddress: 'sachin@tourconnect.com',
          phone: '',
        },
        customFieldValues: [
          {
            field: {
              id: '98621',
              isPerUnitItem: false,
              visiblePerParticipant: false,
            },
            value: 'TEST COMMENT LEAD',
          },
          {
            field: {
              id: '98624',
              isPerUnitItem: false,
              visiblePerParticipant: false,
            },
            value: 835192,
          },
        ],
        participants: [
          {
            customFieldValues: [
              {
                field: {
                  id: '98626',
                  isPerUnitItem: false,
                  visiblePerParticipant: true,
                },
                value: false,
              },
            ],
          },
          {
            customFieldValues: [
              {
                field: {
                  id: '98626',
                  isPerUnitItem: true,
                  visiblePerParticipant: true,
                },
                value: false,
              },
            ],
          },
        ],
      },
      typeDefsAndQueries: {
        bookingTypeDefs: '',
        bookingQuery: '',
      },
    });

    expect(axios).toHaveBeenCalledTimes(1);
    const request = axios.mock.calls[0][0];
    expect(request.data.custom_field_values).toEqual([
      { custom_field: 98621, value: 'TEST COMMENT LEAD' },
      { custom_field: 98624, value: 835192 },
      { custom_field: 98626, value: false },
    ]);
    expect(request.data.customers[1].custom_field_values).toEqual([
      { custom_field: 98626, value: false },
    ]);
    expect(request.data.customers[0].custom_field_values).toEqual([]);
  });

  it('keeps backward compatibility for id|participantIndex unit field ids', async () => {
    jwt.verify.mockResolvedValue({
      availabilityId: 79961022,
      customers: [
        { customer_type_rate: 2648213465 },
        { customer_type_rate: 2648213465 },
      ],
    });
    const axios = jest.fn().mockResolvedValue({
      data: { booking: { pk: 1234 } },
    });

    await app.createBooking({
      axios,
      token,
      payload: {
        availabilityKey: 'fake',
        holder: {
          name: 'Sachin',
          surname: 'Shintre',
          emailAddress: 'sachin@tourconnect.com',
          phone: '',
        },
        customFieldValues: [
          {
            field: {
              id: '98626|1',
              isPerUnitItem: true,
              visiblePerParticipant: true,
            },
            value: true,
          },
        ],
      },
      typeDefsAndQueries: {
        bookingTypeDefs: '',
        bookingQuery: '',
      },
    });

    expect(axios).toHaveBeenCalledTimes(1);
    const request = axios.mock.calls[0][0];
    expect(request.data.customers[0].custom_field_values).toEqual([]);
    expect(request.data.customers[1].custom_field_values).toEqual([
      { custom_field: 98626, value: true },
    ]);
  });

  it('drops non-numeric custom field ids before calling FareHarbor', async () => {
    jwt.verify.mockResolvedValue({
      availabilityId: 79961022,
      customers: [
        { customer_type_rate: 2648213465 },
        { customer_type_rate: 2648213465 },
      ],
    });
    const axios = jest.fn().mockResolvedValue({
      data: { booking: { pk: 1234 } },
    });

    await app.createBooking({
      axios,
      token,
      payload: {
        availabilityKey: 'fake',
        holder: {
          name: 'Sachin',
          surname: 'Shintre',
          emailAddress: 'sachin@tourconnect.com',
          phone: '',
        },
        customFieldValues: [
          {
            field: { id: '98621', isPerUnitItem: false, visiblePerParticipant: false },
            value: 'VALID BOOKING FIELD',
          },
          {
            field: { id: 'place', isPerUnitItem: false, visiblePerParticipant: false },
            value: 'Sydney',
          },
        ],
        participants: [
          {
            customFieldValues: [
              {
                field: { id: '98626', isPerUnitItem: true, visiblePerParticipant: true },
                value: false,
              },
              {
                field: { id: 'startTime', isPerUnitItem: true, visiblePerParticipant: true },
                value: '13:30',
              },
            ],
          },
          { customFieldValues: [] },
        ],
      },
      typeDefsAndQueries: {
        bookingTypeDefs: '',
        bookingQuery: '',
      },
    });

    expect(axios).toHaveBeenCalledTimes(1);
    const request = axios.mock.calls[0][0];
    expect(request.data.custom_field_values).toEqual([
      { custom_field: 98621, value: 'VALID BOOKING FIELD' },
    ]);
    expect(request.data.customers[0].custom_field_values).toEqual([
      { custom_field: 98626, value: false },
    ]);
    expect(request.data.customers[1].custom_field_values).toEqual([]);
  });
});
