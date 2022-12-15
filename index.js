const axiosRaw = require('axios');
const R = require('ramda');
const Promise = require('bluebird');
const assert = require('assert');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const wildcardMatch = require('./utils/wildcardMatch');

const { translateProduct } = require('./resolvers/product');
const { translateAvailability } = require('./resolvers/availability');
const { translateBooking } = require('./resolvers/booking');
const { translateRate } = require('./resolvers/rate');

const CONCURRENCY = 3; // is this ok ?

const axios = async (...args) => {
  return axiosRaw(...args)
  .catch(err => {
    const errMsg = R.path(['response', 'data', 'error'], err);
    console.log(errMsg)
    throw errMsg || err;
  });
};
const isNilOrEmpty = R.either(R.isNil, R.isEmpty);

const getHeaders = ({
  affiliateKey,
  appKey,
}) => ({
  ...affiliateKey ? { 'X-FareHarbor-API-User': affiliateKey }: {},
  ...appKey ? { 'X-FareHarbor-API-App': appKey } : {},
  'Content-Type': 'application/json',
});

class Plugin {
  constructor(params) { // we get the env variables from here
    Object.entries(params).forEach(([attr, value]) => {
      this[attr] = value;
    });
    this.tokenTemplate = () => ({
      appKey: {
        type: 'text',
        regExp: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
        description: 'the App Key provided to the ti2 host from FareHarbor',
      },
      affiliateKey: {
        type: 'text',
        regExp: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
        description: 'the User Key provided by FareHarbor to identify the user',
      },
      endpoint: {
        type: 'text',
        regExp: /^(?!mailto:)(?:(?:http|https|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:(\/|\?|#)[^\s]*)?$/i,
        // default: 'https://fareharbor.com/api/external/v1/companies/COMPANY-CODE',
        description: 'The url api endpoint from FareHarbor and must include the company shortname (replace COMPANYCODE).',
      },
    });
  }

  async validateToken({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
  }) {
    let url = (endpoint || this.endpoint)
      .split('/companies/')[0]
    url = `${url}/companies/`;
    try {
      const headers = getHeaders({
        affiliateKey,
        appKey,
      });
      const companies = R.path(['data', 'companies'], await axios({
        method: 'get',
        url,
        headers,
      }));
      return Array.isArray(companies) && companies.length > 0;
      return false;
    } catch (err) {
      return false;
    }
  }

  async searchProducts({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint = tokenEndpoint,
    },
    payload,
    typeDefsAndQueries: {
      productTypeDefs,
      productQuery,
    },
  }) {
    let url = `${endpoint || tokenEndpoint || this.endpoint}/items/`;
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    let results = R.pathOr([], ['data', 'items'], await axios({
      method: 'get',
      url,
      headers,
    }));
    const company = R.pathOr({}, ['data', 'company'], await axios({
      method: 'get',
      url: `${endpoint}/`,
      headers,
    }));
    if (!Array.isArray(results)) results = [results];
    // console.log({ results })
    let products = await Promise.map(results, async product => {
      return translateProduct({
        rootValue: { ...product, company },
        typeDefs: productTypeDefs,
        query: productQuery,
      });
    });
    // dynamic extra filtering
    if (!isNilOrEmpty(payload)) {
      const extraFilters = R.omit([], payload);
      if (Object.keys(extraFilters).length > 0) {
        products = products.filter(
          product => Object.entries(extraFilters).every(
            ([key, value]) => {
              if (typeof value === 'string') return wildcardMatch(value, product[key]);
              if (key === 'productId') return `${product.productId}` === `${value}`;
              return true;
            },
          ),
        );
      }
    }
    return ({ products, results });
  }

  async searchQuote({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    payload: {
      productIds,
      optionIds,
    },
    typeDefsAndQueries: {
      productTypeDefs,
      productQuery,
      rateTypeDefs,
      rateQuery,
    },
  }) {
    return { quote: [] };
  }

  async searchAvailability({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    token,
    payload: {
      productIds,
      optionIds,
      units: unitsFromPayload,
      startDate,
      endDate,
      dateFormat,
      currency,
    },
    typeDefsAndQueries: {
      availTypeDefs,
      availQuery,
    },
  }) {
    assert(this.jwtKey, 'JWT secret should be set');
    let unitsWithQuantity = unitsFromPayload;
    assert((unitsWithQuantity && unitsWithQuantity.length > 0), 'there should be at least one unit with quantity');
    assert(
      productIds.length === optionIds.length,
      'mismatched productIds/options length',
    );
    assert(productIds.every(Boolean), 'some invalid productId(s)');
    assert(optionIds.every(Boolean), 'some invalid optionId(s)');
    const localDateStart = moment(startDate, dateFormat).format('YYYY-MM-DD');
    const localDateEnd = moment(endDate, dateFormat).format('YYYY-MM-DD');
    // obtain the rates
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/items/${productIds[0]}/minimal/availabilities/date-range/${localDateStart}/${localDateEnd}/?detailed=yes`;
    const avail = R.pathOr([], ['data', 'availabilities'], await axios({
      method: 'get',
      url,
      headers,
    }));
    assert(unitsWithQuantity[0].every(o => o.quantity), 'some invalid occupacies(s)');
    const availabilityByProduct = await Promise.map(productIds, async (productId, idx) => {
      return Promise.map(
        avail.filter(o => {
          return unitsWithQuantity[0].every(u => {
            const foundCus = o.customer_type_rates.find(c => `${u.unitId}` === `${R.path(['customer_prototype', 'pk'], c)}`);
            return foundCus && foundCus.capacity >= u.quantity
          });
        }),
        async obj => {
          return translateAvailability({
            typeDefs: availTypeDefs,
            query: availQuery,
            rootValue: obj,
            variableValues: {
              productId,
              optionId: optionIds[idx],
              currency,
              unitsWithQuantity: unitsWithQuantity[idx],
              jwtKey: this.jwtKey,
            },
          });
        });
    });
    // because we only handle one productId
    // so hard code the array to be single element
    return { availability: availabilityByProduct };
  }

  async availabilityCalendar({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    payload: {
      productIds,
      optionIds,
      startDate,
      endDate,
      dateFormat,
    },
    typeDefsAndQueries: {
      availTypeDefs,
      availQuery,
    },
  }) {
    assert(
      productIds.length === optionIds.length,
      'mismatched productIds/options length',
    );
    assert(productIds.every(Boolean), 'some invalid productId(s)');
    assert(optionIds.every(Boolean), 'some invalid optionId(s)');
    const localDateStart = moment(startDate, dateFormat).format('YYYY-MM-DD');
    const localDateEnd = moment(endDate, dateFormat).format('YYYY-MM-DD');
    const headers = getHeaders({
      affiliateKey,
      appKey,
      endpoint,
    });
    const url = `${endpoint || this.endpoint}/items/${productIds[0]}/minimal/availabilities/date-range/${localDateStart}/${localDateEnd}/`;
    const retVal = await axios({
      method: 'get',
      url,
      headers,
    });
    const availability = await Promise.map(R.pathOr([], ['data', 'availabilities'], retVal), avail => {
      // availabilityKey is not needed for the calendar
      return translateAvailability({
        rootValue: avail,
        typeDefs: availTypeDefs,
        query: availQuery,
      });
    });
    return { availability: [availability] };
  }

  async createBooking({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    payload: {
      availabilityKey,
      notes,
      reference,
      holder,
      rebookingId,
    },
    typeDefsAndQueries: {
      bookingTypeDefs,
      bookingQuery,
    },
  }) {
    try {
      assert(availabilityKey, 'an availability code is required !');
    assert(R.path(['name'], holder), 'a holder\' first name is required');
    assert(R.path(['surname'], holder), 'a holder\' surname is required');
    // assert(R.path(['emailAddress'], holder), 'a holder\' email address is required');
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    let data = await jwt.verify(availabilityKey, this.jwtKey);
    let booking = R.path(['data', 'booking'], await axios({
      method: 'post',
      url: `${endpoint || this.endpoint}/availabilities/${data.availabilityId}/bookings/`,
      data: {
        rebooking: rebookingId,
        note: notes,
        voucher_number: reference,
        contact: {
          name: `${holder.name || ''} ${holder.surname || ''}`.trim(),
          email: holder.emailAddress,
          phone: holder.phone,
        },
        customers: data.customers,
      },
      headers,
    }));
    console.log(booking)
    return ({
      booking: await translateBooking({
        rootValue: booking,
        typeDefs: bookingTypeDefs,
        query: bookingQuery,
      }),
    });
    } catch (err) {
      // console.log(err);
      throw new Error(err);
    }
  }

  async cancelBooking({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    payload: {
      bookingId,
      id,
      reason,
    },
    typeDefsAndQueries: {
      bookingTypeDefs,
      bookingQuery,
    },
  }) {
    try {
      assert(!isNilOrEmpty(bookingId) || !isNilOrEmpty(id), 'Invalid booking id');
      const headers = getHeaders({
        affiliateKey,
        appKey,
      });
      const url = `${endpoint || this.endpoint}/bookings/${bookingId || id}/`;
      const booking = R.path(['data', 'booking'], await axios({
        method: 'delete',
        url,
        headers,
      }));
      return ({
        cancellation: await translateBooking({
          rootValue: booking,
          typeDefs: bookingTypeDefs,
          query: bookingQuery,
        })
      });
    } catch (err) {
      console.log('cancel', err);
      throw new Error(err);
    }
  }

  async searchBooking({
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
    },
    payload: {
      bookingId,
      // we can only access booking by id
      // resellerReference,
      // supplierBookingId,
      // travelDateStart,
      // travelDateEnd,
      // dateFormat,
    },
    typeDefsAndQueries: {
      bookingTypeDefs,
      bookingQuery,
    },
  }) {
    try {
      assert(bookingId, 'bookingId is required');
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/bookings/${bookingId}/`;
    const booking = R.path(['data', 'booking'], await axios({
      method: 'get',
      url,
      headers,
    }));
    return ({ bookings: [await translateBooking({
      rootValue: booking, 
      typeDefs: bookingTypeDefs,
      query: bookingQuery,
    })] });
    } catch (err) {
      console.log('search', err);
      throw new Error(err);
    }
  }
}

module.exports = Plugin;
