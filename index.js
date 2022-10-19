const axios = require('axios');
const R = require('ramda');
const Promise = require('bluebird');
const assert = require('assert');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const wildcardMatch = require('./utils/wildcardMatch');

const { translateProduct } = require('./schema/product');
const { translateAvailability } = require('./schema/availability');
const { translateBooking } = require('./schema/booking');
const { translateRate } = require('./schema/rate');

const CONCURRENCY = 3; // is this ok ?

const isNilOrEmpty = R.either(R.isNil, R.isEmpty);

const getHeaders = ({
  userKey,
  appKey,
}) => ({
  ...userKey ? { 'X-FareHarbor-API-User': userKey }: {},
  ...appKey ? { 'X-FareHarbor-API-App': appKey } : {},
  'Content-Type': 'application/json',
});

class Plugin {
  constructor(params) { // we get the env variables from here
    Object.entries(params).forEach(([attr, value]) => {
      this[attr] = value;
    });
  }

  async validateToken({
    token: {
      userKey,
      appKey,
      endpoint,
    }
  }) {
    let url = `${endpoint || this.endpoint}/companies/`;
    try {
      const headers = getHeaders({
        userKey,
        appKey,
      });
      const companies = R.path(['data', 'companies'], await axios({
        method: 'get',
        url,
        headers,
      }));
      return Array.isArray(companies);
      return false;
    } catch (err) {
      return false;
    }
  }

  async searchProducts({
    token: {
      userKey,
      appKey,
      endpoint,
    },
    payload,
  }) {
    let url = `${endpoint || this.endpoint}/items/`;
    const headers = getHeaders({
      userKey,
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
      userKey,
      appKey,
      endpoint,
    },
    payload: {
      productIds,
      optionIds,
      occupancies,
    },
  }) {
    assert(occupancies.length > 0, 'there should be at least one occupancy');
    assert(productIds.length === optionIds.length, 'mismatched product/option combinations');
    assert(productIds.length === occupancies.length, 'mismatched product/occupancies combinations');
    assert(productIds.every(Boolean), 'some invalid productId(s)');
    assert(optionIds.every(Boolean), 'some invalid optionId(s)');
    assert(occupancies.every(Boolean), 'some invalid occupacies(s)');
    const quote = occupancies.map(() => productIds.map(productId => ({ productId })));
    const headers = getHeaders({
      userKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/items/`;
    const rawProducts = R.path(['data', 'items'], await axios({
      method: 'get',
      url,
      headers,
    }));
    let productsDetail = await Promise.map(R.uniq(productIds), async productId => {
      return translateProduct({
        rootValue: rawProducts.find(p => `${p.pk}` === `${productId}`),
      });
    }, { concurrency: CONCURRENCY });
    productsDetail = R.indexBy(R.prop('productId'), productsDetail);
    // console.log({ optionIds });
    await Promise.each(productIds, async (productId, productIdIx) => {
      const optionDetail = productsDetail[productId]
        .options.filter(({ optionId }) => optionId === optionIds[productIdIx])[0];
      quote[productIdIx] = await Promise.map(
        pickUnit(optionDetail.units, occupancies[productIdIx]), e => {
          return translateRate({ rootValue: e });
        });
    });
    return { quote };
  }

  async searchAvailability({
    token: {
      userKey,
      appKey,
      endpoint,
    },
    token,
    payload: {
      productIds,
      optionIds,
      occupancies,
      units: unitsFromPayload,
      startDate,
      endDate,
      dateFormat,
      currency,
    },
  }) {
    assert(this.jwtKey, 'JWT secret should be set');
    let unitsWithQuantity = unitsFromPayload;
    assert((unitsWithQuantity && unitsWithQuantity.length > 0) || (occupancies && occupancies.length > 0), 'there should be at least one occupancy');
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
      userKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/items/${productIds[0]}/minimal/availabilities/date-range/${localDateStart}/${localDateEnd}/?detailed=yes`;
    const avail = R.pathOr([], ['data', 'availabilities'], await axios({
      method: 'get',
      url,
      headers,
    }));
    if (!unitsWithQuantity && occupancies.length > 0) {
      unitsWithQuantity = await Promise.map(productIds, async (productId, idx) => {
        const { products: [product] } = await this.searchProducts({ token, payload: { productId } });
        // retVal is an array of units
        const retVal = pickUnit(product.options[0].units, occupancies[idx]);
        return R.values(retVal.reduce((result, item) => {
          if (result[item.unitId]) result[item.unitId].quantity++;
          else result[item.unitId] = { unitId: item.unitId, quantity: 1 };
          return result;
        }, {}));
      });
    }
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
      userKey,
      appKey,
      endpoint,
    },
    payload: {
      productIds,
      optionIds,
      startDate,
      endDate,
      dateFormat,
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
      userKey,
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
      });
    });
    return { availability: [availability] };
  }

  async createBooking({
    token: {
      userKey,
      appKey,
      endpoint,
    },
    payload: {
      availabilityKey,
      notes,
      reference,
      holder,
      rebookingId,
    },
  }) {
    try {
      assert(availabilityKey, 'an availability code is required !');
    assert(R.path(['name'], holder), 'a holder\' first name is required');
    assert(R.path(['surname'], holder), 'a holder\' surname is required');
    assert(R.path(['emailAddress'], holder), 'a holder\' email address is required');
    const headers = getHeaders({
      userKey,
      appKey,
    });
    let data = await jwt.verify(availabilityKey, this.jwtKey);
    let booking = R.path(['data', 'booking'], await axios({
      method: 'post',
      url: `${endpoint || this.endpoint}/availabilities/${data.availabilityId}/bookings/`,
      data: {
        rebooking: rebookingId,
        note: `${notes || ''}${reference ? `\n[Reseller Ref: ${reference} :end]` : ''}`,
        contact: {
          name: `${holder.name || ''} ${holder.surname || ''}`.trim(),
          email: holder.emailAddress,
          phone: holder.phone,
        },
        customers: data.customers,
      },
      headers,
    }));
    return ({ booking: await translateBooking({ rootValue: booking }) });
    } catch (err) {
      // console.log(err);
      throw new Error(err);
    }
  }

  async cancelBooking({
    token: {
      userKey,
      appKey,
      endpoint,
    },
    payload: {
      bookingId,
      id,
      reason,
    },
  }) {
    try {
      assert(!isNilOrEmpty(bookingId) || !isNilOrEmpty(id), 'Invalid booking id');
      const headers = getHeaders({
        userKey,
        appKey,
      });
      const url = `${endpoint || this.endpoint}/bookings/${bookingId || id}/`;
      const booking = R.path(['data', 'booking'], await axios({
        method: 'delete',
        url,
        headers,
      }));
      return ({ cancellation: await translateBooking({ rootValue: booking }) });
    } catch (err) {
      console.log('cancel', err);
      throw new Error(err);
    }
  }

  async searchBooking({
    token: {
      userKey,
      appKey,
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
  }) {
    try {
      assert(bookingId, 'bookingId is required');
    const headers = getHeaders({
      userKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/bookings/${bookingId}/`;
    const booking = R.path(['data', 'booking'], await axios({
      method: 'get',
      url,
      headers,
    }));
    return ({ bookings: [await translateBooking({ rootValue: booking })] });
    } catch (err) {
      console.log('search', err);
      throw new Error(err);
    }
  }
}

const pickUnit = (units, paxs) => {
  const evalOne = (unit, pax) => {
    if (pax.age < R.path(['restrictions', 'minAge'], unit)) {
      return false;
    }
    if (pax.age > R.path(['restrictions', 'maxAge'], unit)) {
      return false;
    }
    return true;
  };
  if (paxs.length > 1) { // find group units
    const group = units.filter(({ restrictions }) => Boolean(restrictions)).find(unit => {
      if (
        R.path(['restrictions', 'paxCount'], unit) === paxs.length
        && paxs.every(pax => evalOne(unit, pax))
      ) return true;
      return false;
    });
    if (group) return [group];
  }
  return paxs.map(pax => units
    .filter(unit => R.path(['restrictions', 'paxCount'], unit) === 1)
    .find(unit => evalOne(unit, pax))); // individual units
};

module.exports = Plugin;
module.exports.pickUnit = pickUnit;
