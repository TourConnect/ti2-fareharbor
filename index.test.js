/* globals describe, beforeAll, it, expect */
const R = require('ramda');
const moment = require('moment');
const faker = require('faker');

const Plugin = require('./index');
const rawUnits = require('./__fixtures__/raw-units.js');
const rawProduct = require('./__fixtures__/raw-product');
const rawAvail = require('./__fixtures__/raw-availability');
const rawBooking = require('./__fixtures__/raw-booking');

const { translateProduct } = require('./schema/product');
const { translateAvailability } = require('./schema/availability');
const { translateBooking } = require('./schema/booking');
const { translateRate } = require('./schema/rate');

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
    userKey: process.env.ti2_fareharbor_userKey,
  };
  const dateFormat = 'DD/MM/YYYY';
  beforeAll(async () => {
    // nada
  });
  describe('utilities & data translators', () => {
    describe('pickUnit', () => {
      it('adult', () => {
        const result = Plugin.pickUnit(rawUnits, [{ age: 40 }]);
        expect(result.length).toBe(1);
        expect(result[0]).toContainObject([{ unitName: 'Adult' }]);
      });
      it('child', () => {
        const result = Plugin.pickUnit(rawUnits, [{ age: 10 }]);
        expect(result.length).toBe(1);
        expect(result[0]).toContainObject([{ unitName: 'Child' }]);
      });
      it('senior', () => {
        const result = Plugin.pickUnit(rawUnits, [{ age: 70 }]);
        expect(result.length).toBe(1);
        expect(result[0]).toContainObject([{ unitName: 'Senior' }]);
      });
      it.todo('family + one');
    });
    describe('translators', () => {
      it('translateProduct', async () => {
        const translated = await translateProduct({ rootValue: rawProduct });
        expect(translated).toMatchSnapshot();
      });
      it('translateAvail', async () => {
        const translated = await translateAvailability({
          rootValue: rawAvail,
        });
        expect(translated).toMatchSnapshot();
      });
      it('translateBooking', async () => {
        const translated = await translateBooking({
          rootValue: rawBooking,
        });
        expect(translated).toMatchSnapshot();
      });
      it('translateRate', async () => {
        const translated = await translateRate({
          rootValue: rawUnits[0],
        });
        expect(translated).toMatchSnapshot();
      });
    })
  });
  describe('booking process', () => {
    it('get for all products, a test product should exist', async () => {
      const retVal = await app.searchProducts({
        token,
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
        payload: {
          bookingId: booking.id,
        },
      });
      expect(Array.isArray(retVal.bookings)).toBeTruthy();
      ({ bookings } = retVal);
      expect(R.path([0, 'id'], bookings)).toBeTruthy();
    });
    it.skip('it should be able to search bookings by reference', async () => {
      const retVal = await app.searchBooking({
        token,
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
