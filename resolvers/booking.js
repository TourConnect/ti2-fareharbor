const { makeExecutableSchema } = require('@graphql-tools/schema');
const R = require('ramda');
const { graphql } = require('graphql');

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
    resellerReference: R.propOr('', 'voucher_number'),
    publicUrl: R.prop('confirmation_url'),
    privateUrl: R.prop('dashboard_url'),
  },
};


const translateBooking = async ({ rootValue, typeDefs, query }) => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });
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
