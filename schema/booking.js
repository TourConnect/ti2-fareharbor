const { makeExecutableSchema } = require('@graphql-tools/schema');
const R = require('ramda');
const { graphql } = require('graphql');

const typeDefs = `
  type Holder {
    name: String
    surname: String
    fullName: String
    phoneNumber: String
    emailAddress: String
  }
  type UnitItem {
    unitItemId: ID
    unitId: ID
    unitName: String
  }
  type Price {
    original: Int
    retail: Int
    net: Int
    currencyPrecision: Int
  }
  type Query {
    id: ID
    orderId: ID
    bookingId: ID
    supplierBookingId: ID
    status: String
    productId: String
    productName: String
    optionId: String
    optionName: String
    cancellable: Boolean
    unitItems: [UnitItem]
    start: String
    end: String
    allDay: Boolean
    bookingDate: String
    holder: Holder
    notes: String
    price: Price
    cancelPolicy: String
  }
`;

const query = `{
  id
  orderId
  bookingId
  supplierBookingId
  status
  productId
  productName
  optionId
  optionName
  cancellable
  unitItems {
    unitItemId
    unitId
    unitName
  }
  start
  end
  allDay
  bookingDate
  holder {
    name
    surname
    fullName
    phoneNumber
    emailAddress
  }
  notes
  price {
    original
    retail
    net
    currencyPrecision
  }
  cancelPolicy
}`;

const capitalize = sParam => {
  if (typeof sParam !== 'string') return '';
  const s = sParam.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};
const resolvers = {
  Query: {
    id: R.path(['uuid']),
    orderId: R.path(['display_id']),
    bookingId: R.path(['uuid']),
    supplierBookingId: R.path(['display_id']),
    status: e => capitalize(R.path(['status'], e)),
    productId: R.path(['availability', 'item', 'pk']),
    productName: R.path(['availability', 'item', 'name']),
    optionId: R.path(['availability', 'item', 'pk']),
    optionName: R.path(['availability', 'item', 'name']),
    cancellable: root => {
      if (root.status === 'cancelled') return false;
      return R.prop('is_eligible_for_cancellation', root);
    },
    unitItems: ({ customers }) => customers,
    start: R.path(['availability', 'start_at']),
    end: R.path(['availability', 'end_at']),
    allDay: () => false,
    bookingDate: R.path(['utcCreatedAt']),
    holder: R.path(['contact']),
    notes: R.path(['note']),
    price: root => ({
      original: R.path(['receipt_total'], root),
      retail: R.path(['receipt_total'], root),
      currencyPrecision: 2,
      currency: R.path(['company', 'currency'], root),
    }),
    cancelPolicy: R.path(['effective_cancellation_policy', 'type']),
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const translateBooking = async ({ rootValue }) => {
  const retVal = await graphql({
    schema,
    rootValue,
    source: query,
  });
  if (retVal.errors) throw new Error(retVal.errors);
  return retVal.data;
};

module.exports = {
  translateBooking,
};
