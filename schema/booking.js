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
    currency: String
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
    editable: Boolean
    unitItems: [UnitItem]
    start: String
    end: String
    allDay: Boolean
    bookingDate: String
    holder: Holder
    notes: String
    price: Price
    cancelPolicy: String
    resellerReference: String
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
  editable
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
    currency
  }
  cancelPolicy
  optionId
  resellerReference
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
    cancellable: root => {
      if (root.status.toLowerCase() === 'cancelled') return false;
      if (root.status.toLowerCase() === 'rebooked') return false;
      return R.prop('is_eligible_for_cancellation', root);
    },
    editable: root => {
      if (root.status.toLowerCase() === 'cancelled') return false;
      if (root.status.toLowerCase() === 'rebooked') return false;
      return true;
    },
    unitItems: ({ customers }) => customers.map(customer => ({
      unitItemId: customer.pk,
      unitId: R.path(['customer_type_rate', 'customer_prototype', 'pk'], customer),
      unitName: R.path(['customer_type_rate', 'customer_prototype', 'display_name'], customer),
    })),
    start: R.path(['availability', 'start_at']),
    end: R.path(['availability', 'end_at']),
    allDay: () => false,
    bookingDate: R.path(['utcCreatedAt']),
    holder: root => ({
      name: R.path(['contact', 'name'], root).split(' ')[0],
      surname: R.last(R.path(['contact', 'name'], root).split(' ')),
      fullName: R.path(['contact', 'name'], root),
      phoneNumber: R.path(['contact', 'phone'], root),
      emailAddress: R.path(['contact', 'email'], root),
    }),
    notes: root => {
      const note = root.note || '';
      if (note.indexOf('[Reseller Ref:') === -1) return note;
      const beforeRef = note.split('[Reseller Ref:')[0];
      const afterRef = R.last(note.split(':end]'));
      return `${beforeRef || ''} ${afterRef || ''}`.trim();
    },
    price: root => ({
      original: R.path(['receipt_total'], root),
      retail: R.path(['receipt_total'], root),
      currencyPrecision: 2,
      currency: R.path(['company', 'currency'], root),
    }),
    cancelPolicy: R.path(['effective_cancellation_policy', 'type']),
    optionId: () => 'default',
    optionName: R.path(['availability', 'item', 'name']),
    resellerReference: root => {
      const note = root.note || '';
      if (note.indexOf('[Reseller Ref:') === -1) return '';
      return R.call(R.compose(
        R.head,
        R.split(':end]'),
        R.last,
        R.split('[Reseller Ref:'),
      ), note)
    }
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
