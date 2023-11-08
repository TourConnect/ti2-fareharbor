const R = require('ramda');
const Promise = require('bluebird');
const assert = require('assert');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const wildcardMatch = require('./utils/wildcardMatch');

const { translateProduct } = require('./resolvers/product');
const { translateAvailability } = require('./resolvers/availability');
const { translateBooking } = require('./resolvers/booking');
const { translatePickupPoint } = require('./resolvers/pickup-point');

const CONCURRENCY = 3; // is this ok ?

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
      affiliateShortName: {
        type: 'text',
        regExp: /[0-9a-z]/,
        description: 'short name for the affiliate company',
      },
      shortName: {
        type: 'text',
        regExp: /[0-9a-z]/,
        description: 'short name for your company',
      },
      endpoint: {
        type: 'text',
        regExp: /^(?!mailto:)(?:(?:http|https|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:(\/|\?|#)[^\s]*)?$/i,
        // default: 'https://fareharbor.com/api/external/v1/companies',
        description: 'The url api endpoint from FareHarbor and must include the company shortname (replace COMPANYCODE).',
      },
    });
    this.errorPathsAxiosErrors = () => ([ // axios triggered errors
      ['response', 'data', 'error'],
    ]);
    this.errorPathsAxiosAny = () => ([]); // 200's that should be errors
  }

  async validateToken({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      shortName,
      endpoint,
    },
  }) {
    let url = `${endpoint || this.endpoint}/${shortName.trim()}/items/`;
    try {
      const headers = getHeaders({
        affiliateKey,
        appKey,
      });
      const items = R.path(['data', 'items'], await axios({
        method: 'get',
        url,
        headers,
      }));
      return Boolean(items && items.length);
    } catch (err) {
      return false;
    }
  }

  async searchProducts({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
    },
    payload,
    typeDefsAndQueries: {
      productTypeDefs,
      productQuery,
    },
  }) {
    let url = `${endpoint || this.endpoint}/${shortName.trim()}/items/`;
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
      url: `${endpoint || this.endpoint}/${shortName.trim()}/`,
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
      shortName,
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
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
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
    const url = `${endpoint || this.endpoint}/${shortName.trim()}/items/${productIds[0]}/minimal/availabilities/date-range/${localDateStart}/${localDateEnd}/?detailed=yes`;
    const avail = R.pathOr([], ['data', 'availabilities'], await axios({
      method: 'get',
      url,
      headers,
    }));
    assert(unitsWithQuantity[0].every(o => o.quantity), 'some invalid occupacies(s)');
    const availabilityByProduct = await Promise.map(productIds, async (productId, idx) => {
      return Promise.map(
        // avail.filter(o => {
        //   return unitsWithQuantity[0].every(u => {
        //     const foundCus = o.customer_type_rates.find(c => `${u.unitId}` === `${R.path(['customer_prototype', 'pk'], c)}`);
        //     return foundCus && foundCus.capacity >= u.quantity
        //   });
        // }),
        avail,
        async obj => {
          const lodgings = R.pathOr([], ['data', 'lodgings'], await axios({
            method: 'get',
            url: `${endpoint || this.endpoint}/${shortName.trim()}/availabilities/${obj.pk}/lodgings/`,
            headers,
          }));
          return translateAvailability({
            typeDefs: availTypeDefs,
            query: availQuery,
            rootValue: { ...obj, lodgings },
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
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
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
    });
    const url = `${endpoint || this.endpoint}/${shortName.trim()}/items/${productIds[0]}/minimal/availabilities/date-range/${localDateStart}/${localDateEnd}/`;
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
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
    },
    payload: {
      availabilityKey,
      notes,
      reference,
      desk,
      agent,
      holder,
      rebookingId,
      pickupPoint,
      customFieldValues,
    },
    typeDefsAndQueries: {
      bookingTypeDefs,
      bookingQuery,
    },
  }) {
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
      url: `${endpoint || this.endpoint}/${shortName.trim()}/availabilities/${data.availabilityId}/bookings/`,
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
        ...(pickupPoint && !isNaN(pickupPoint) ? { lodging: parseInt(pickupPoint) } : {}),
        ...(desk && !isNaN(desk) ? { desk: parseInt(desk) } : {}),
        ...(agent && !isNaN(agent)  ? { agent: parseInt(agent) } : {}),
        ...(customFieldValues && customFieldValues.length ? {
          custom_field_values: customFieldValues.filter(o => !R.isNil(o.value)).map(o => ({
            custom_field: o.field.id,
            value: o.value && o.value.value ? o.value.value : o.value,
            // ...(o.field.type === 'extended-option' ? { 'extended_option': o.value.value } : {})
          }))
        } : {})
      },
      headers,
    }));
    return ({
      booking: await translateBooking({
        rootValue: booking,
        typeDefs: bookingTypeDefs,
        query: bookingQuery,
      }),
    });
  }

  async cancelBooking({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
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
    assert(!isNilOrEmpty(bookingId) || !isNilOrEmpty(id), 'Invalid booking id');
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/${shortName.trim()}/bookings/${bookingId || id}/`;
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
  }

  async searchBooking({
    axios,
    token,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
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
    assert(bookingId, 'bookingId is required');
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/${shortName.trim()}/bookings/${bookingId}/`;
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
  }

  async getAffiliateDesks({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      affiliateShortName = '',
    },
  }) {
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/${affiliateShortName.trim()}/desks/`;
    const desks = R.path(['data', 'desks'], await axios({
      method: 'get',
      url,
      headers,
    }));
    return {
      desks: desks.map(d => ({
        id: d.pk,
        name: d.name,
      }))
    }
  }

  async getAffiliateAgents({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      affiliateShortName = '',
    },
  }) {
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/${affiliateShortName.trim()}/agents/`;
    const agents = R.path(['data', 'agents'], await axios({
      method: 'get',
      url,
      headers,
    }));
    return {
      agents: agents.map(d => ({
        id: d.pk,
        name: d.name,
      }))
    }
  }

  async getPickupPoints({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
    },
    typeDefsAndQueries: {
      pickupTypeDefs,
      pickupQuery,
    },
  }) {
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    const url = `${endpoint || this.endpoint}/${shortName.trim()}/lodgings/`;
    const lodgings = R.path(['data', 'lodgings'], await axios({
      method: 'get',
      url,
      headers,
    }));
    return ({ pickupPoints: await Promise.map(lodgings, lodging => translatePickupPoint({
      rootValue: lodging, 
      typeDefs: pickupTypeDefs,
      query: pickupQuery,
    })) });
  }

  async getCreateBookingFields({
    axios,
    token: {
      affiliateKey,
      appKey = this.appKey,
      endpoint,
      shortName,
    },
    query: {
      productId,
      date,
      dateFormat,
    }
  }) {
    const headers = getHeaders({
      affiliateKey,
      appKey,
    });
    if (!productId) return { fields: [], customFields: [] };
    let avail = R.pathOr([], ['data', 'availabilities', 0], await axios({
      method: 'get',
      url: `${endpoint || this.endpoint}/${shortName.trim()}/items/${productId}/minimal/availabilities/date/${
        date
          ? moment(date, dateFormat).format('YYYY-MM-DD') 
          : moment().add(1, 'M').format('YYYY-MM-DD')
      }/`,
      headers,
    }));
    if (!avail) return { fields: [] };
    const detailedAvail = R.path(['data', 'availability'], await axios({
      url: `${endpoint || this.endpoint}/${shortName.trim()}/availabilities/${avail.pk}/`,
      method: 'get',
      headers,
    }));
    if (!R.path(['custom_field_instances', 'length'], detailedAvail)) {
      return { fields: [], customFields: [] };
    }
    // https://github.com/FareHarbor/fareharbor-docs/blob/master/external-api/custom-fields.md
    // https://github.com/FareHarbor/fareharbor-docs/blob/master/external-api/data-types.md
    return ({
      fields: [],
      customFields: R.path(['custom_field_instances'], detailedAvail).map(o => ({
        id: o.custom_field.pk,
        subtitle: o.custom_field.name === o.custom_field.title ? '' : o.custom_field.name,
        title: o.custom_field.title,
        // The custom field's type. Supported types: yes-no, short, long, count, and extended-option.
        type: o.custom_field.type,
        options: o.custom_field.extended_options ? o.custom_field.extended_options.map(o => ({
          value: o.pk,
          label: o.name,
        })) : undefined,
      }))
    });
  }
}

module.exports = Plugin;
