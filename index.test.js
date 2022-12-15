/* globals describe, beforeAll, it, expect */
const R = require('ramda');
const moment = require('moment');
const faker = require('faker');
const { typeDefs: productTypeDefs, query: productQuery } = require('./node_modules/ti2/controllers/graphql-schemas/product');
const { typeDefs: availTypeDefs, query: availQuery } = require('./node_modules/ti2/controllers/graphql-schemas/availability');
const { typeDefs: bookingTypeDefs, query: bookingQuery } = require('./node_modules/ti2/controllers/graphql-schemas/booking');
const { typeDefs: rateTypeDefs, query: rateQuery } = require('./node_modules/ti2/controllers/graphql-schemas/rate');

const typeDefsAndQueries = {
  productTypeDefs,
  productQuery,
  availTypeDefs,
  availQuery,
  bookingTypeDefs,
  bookingQuery,
  rateTypeDefs,
  rateQuery,
};
const Plugin = require('./index');
const rawUnits = require('./__fixtures__/raw-units.js');
const rawProduct = require('./__fixtures__/raw-product');
const rawAvail = require('./__fixtures__/raw-availability');
const rawBooking = require('./__fixtures__/raw-booking');

const { translateProduct } = require('./resolvers/product');
const { translateAvailability } = require('./resolvers/availability');
const { translateBooking } = require('./resolvers/booking');
const { translateRate } = require('./resolvers/rate');

const app = new Plugin({
  jwtKey: process.env.ti2_fareharbor_jwtKey,
});

const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

describe('search tests', () => {
  let products;
  let testProduct = {
    productName: 'Daily Cruise Tour',
  };
  const token = {
    appKey: process.env.ti2_fareharbor_appKey,
    endpoint: process.env.ti2_fareharbor_endpoint,
    affiliateKey: process.env.ti2_fareharbor_userKey,
  };
  const dateFormat = 'DD/MM/YYYY';
  beforeAll(async () => {
    // nada
  });
  describe('utilities & data translators', () => {
    describe('validateToken', () => {
      it('valid token', async () => {
        const retVal = await app.validateToken({
          token,
        });
        expect(retVal).toBeTruthy();
      });
      it('invalid token', async () => {
        const retVal = await app.validateToken({
          token: { ...token, affiliateKey: 'somerandom' },
        });
        expect(retVal).toBeFalsy();
      });
    });
    describe('template', () => {
      let template;
      it('get the template', async () => {
        template = await app.tokenTemplate();
        const rules = Object.keys(template);
        expect(rules).toContain('affiliateKey');
        expect(rules).toContain('endpoint');
        expect(rules).toContain('appKey');
      });
      it('appKey', () => {
        const appKey = template.appKey.regExp;
        expect(appKey.test('something')).toBeFalsy();
        expect(appKey.test('f5eb2e1f-4b8f-4b43-a858-4a12d77b8299')).toBeTruthy();
      });
      it('affiliateKey', () => {
        const affiliateKey = template.affiliateKey.regExp;
        expect(affiliateKey.test('something')).toBeFalsy();
        expect(affiliateKey.test('f5eb2e1f-4b8f-4b43-a858-4a12d77b8299')).toBeTruthy();
      });
      it('endpoint', () => {
        const endpoint = template.endpoint.regExp;
        expect(endpoint.test('something')).toBeFalsy();
        expect(endpoint.test('https://www.yahoo.com')).toBeTruthy();
        expect(endpoint.test('https://demo.fareharbor.com/api/external/v1/companies/fhcabtours-aud')).toBeTruthy();
      });
    });
    describe('translators', () => {
      it('translateProduct', async () => {
        const translated = await translateProduct({
          rootValue: rawProduct,
          typeDefs: productTypeDefs,
          query: productQuery,
        });
        expect(translated).toMatchSnapshot();
      });
      it('translateAvail', async () => {
        const translated = await translateAvailability({
          rootValue: rawAvail,
          typeDefs: availTypeDefs,
          query: availQuery,
        });
        expect(translated).toMatchSnapshot();
      });
      it('translateBooking', async () => {
        const translated = await translateBooking({
          rootValue: rawBooking,
          typeDefs: bookingTypeDefs,
          query: bookingQuery,
        });
        expect(translated).toMatchSnapshot();
      });
      it('translateRate', async () => {
        const translated = await translateRate({
          rootValue: rawUnits[0],
          typeDefs: rateTypeDefs,
          query: rateQuery,
        });
        expect(translated).toMatchSnapshot();
      });
    })
  });
  describe('booking process', () => {
    it('get for all products, a test product should exist', async () => {
      const retVal = await app.searchProducts({
        token,
        typeDefsAndQueries,
      });
      expect(Array.isArray(retVal.products)).toBeTruthy();
      // console.log(retVal.products.filter(({ productName }) => productName === testProduct.productName));
      expect(retVal.products).toContainObject([{
        productName: testProduct.productName,
      }]);
      testProduct = {
        ...retVal.products.find(({ productName }) => productName === testProduct.productName),
      };
      expect(testProduct.productId).toBeTruthy();
    });
    it('should be able to get a single product', async () => {
      const retVal = await app.searchProducts({
        token,
        typeDefsAndQueries,
        payload: {
          productId: testProduct.productId,
        },
      });
      expect(Array.isArray(retVal.products)).toBeTruthy();
      expect(retVal.products).toHaveLength(1);
    });
    let busProducts = [];
    it('should be able to get a product by name', async () => {
      const retVal = await app.searchProducts({
        token,
        typeDefsAndQueries,
        payload: {
          productName: '*da*',
        },
      });
      expect(Array.isArray(retVal.products)).toBeTruthy();
      expect(retVal.products.length).toBeGreaterThan(0);
      busProducts = retVal.products;
    });
    it('should be able to get an availability calendar', async () => {
      const retVal = await app.availabilityCalendar({
        token,
        typeDefsAndQueries,
        payload: {
          startDate: moment().add(6, 'M').format(dateFormat),
          endDate: moment().add(6, 'M').add(2, 'd').format(dateFormat),
          dateFormat,
          productIds: [32439],
          optionIds: ['default'],
          occupancies: [
            [{ age: 30 }, { age: 40 }],
          ],
        },
      });
      expect(retVal).toBeTruthy();
      const { availability } = retVal;
      expect(availability).toHaveLength(1);
      expect(availability[0].length).toBeGreaterThan(0);
    });
    it('should be able to get quotes', async () => {
      const retVal = await app.searchQuote({
        token,
        typeDefsAndQueries,
        payload: {
          startDate: moment().add(6, 'M').format(dateFormat),
          endDate: moment().add(6, 'M').add(2, 'd').format(dateFormat),
          dateFormat,
          productIds: busProducts.map(({ productId }) => productId),
          optionIds: busProducts.map(({ options }) =>
            faker.random.arrayElement(options).optionId),
          occupancies: [
            [{ age: 30 }, { age: 40 }],
          ],
        },
      });
      expect(retVal).toBeTruthy();
      const { quote } = retVal;
      expect(quote.length).toBeGreaterThan(0);
      expect(quote[0]).toContainObject([{
        rateName: 'adult',
        pricing: expect.toContainObject([{
          currencyPrecision: 2,
        }]),
      }]);
    });
    let availabilityKey;
    it('should be able to get availability', async () => {
      const retVal = await app.searchAvailability({
        token,
        typeDefsAndQueries,
        payload: {
          startDate: moment().add(6, 'M').format(dateFormat),
          endDate: moment().add(6, 'M').add(2, 'd').format(dateFormat),
          dateFormat,
          productIds: [32439],
          optionIds: ['default'],
          occupancies: [
            [{ age: 30 }, { age: 40 }, { age: 70 }],
          ],
        },
      });
      expect(retVal).toBeTruthy();
      const { availability } = retVal;
      expect(availability).toHaveLength(1);
      expect(availability[0].length).toBeGreaterThan(0);
      availabilityKey = R.path([0, 0, 'key'], availability);
      expect(availabilityKey).toBeTruthy();
    });
    let booking;
    const reference = faker.datatype.uuid();
    it('should be able to create a booking', async () => {
      const fullName = faker.name.findName().split(' ');
      const retVal = await app.createBooking({
        token,
        typeDefsAndQueries,
        payload: {
          availabilityKey,
          notes: faker.lorem.paragraph(),
          holder: {
            name: fullName[0],
            surname: fullName[1],
            phone: faker.phone.phoneNumber(),
            emailAddress: `salvador+tests_${faker.lorem.slug()}@tourconnect.com`,
            country: faker.address.countryCode(),
            locales: ['en-US', 'en', 'es'],
          },
          reference,
        },
      });
      expect(retVal.booking).toBeTruthy();
      ({ booking } = retVal);
      expect(booking).toBeTruthy();
      expect(R.path(['id'], booking)).toBeTruthy();
      expect(R.path(['cancellable'], booking)).toBeTruthy();
      // console.log({ booking });
    });
    it('should be able to cancel the booking', async () => {
      const retVal = await app.cancelBooking({
        token,
        typeDefsAndQueries,
        payload: {
          bookingId: booking.id,
          reason: faker.lorem.paragraph(),
        },
      });
      const { cancellation } = retVal;
      expect(cancellation).toBeTruthy();
      expect(cancellation).toBeTruthy();
      expect(R.path(['id'], cancellation)).toBeTruthy();
      expect(R.path(['cancellable'], cancellation)).toBeFalsy();
    });
    let bookings = [];
    it('it should be able to search bookings by id', async () => {
      const retVal = await app.searchBooking({
        token,
        typeDefsAndQueries,
        payload: {
          bookingId: booking.id,
        },
      });
      expect(Array.isArray(retVal.bookings)).toBeTruthy();
      ({ bookings } = retVal);
      expect(R.path([0, 'id'], bookings)).toBeTruthy();
    }, 30e3);
    it.skip('it should be able to search bookings by reference', async () => {
      const retVal = await app.searchBooking({
        token,
        typeDefsAndQueries,
        payload: {
          bookingId: reference,
        },
      });
      expect(Array.isArray(retVal.bookings)).toBeTruthy();
      ({ bookings } = retVal);
      expect(R.path([0, 'id'], bookings)).toBeTruthy();
    });
    it.skip('it should be able to search bookings by supplierBookingId', async () => {
      const retVal = await app.searchBooking({
        token,
        typeDefsAndQueries,
        payload: {
          bookingId: booking.supplierBookingId,
        },
      });
      expect(Array.isArray(retVal.bookings)).toBeTruthy();
      ({ bookings } = retVal);
      expect(R.path([0, 'id'], bookings)).toBeTruthy();
    });
    it.skip('it should be able to search bookings by travelDate', async () => {
      const retVal = await app.searchBooking({
        token,
        typeDefsAndQueries,
        payload: {
          travelDateStart: moment().add(6, 'M').format(dateFormat),
          travelDateEnd: moment().add(6, 'M').add(2, 'd').format(dateFormat),
          dateFormat,
        },
      });
      expect(Array.isArray(retVal.bookings)).toBeTruthy();
      ({ bookings } = retVal);
      expect(R.path([0, 'id'], bookings)).toBeTruthy();
    });
  });
});
