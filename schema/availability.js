const { makeExecutableSchema } = require('@graphql-tools/schema');
const { graphql } = require('graphql');
const R = require('ramda');
const jwt = require('jsonwebtoken');

const typeDefs = `
  input UnitWithQuantity {
    unitId: ID
    quantity: Int
  }
  type Pricing {
    unitId: ID
    original: Int
    retail: Int
    net: Int
    currencyPrecision: Int
  }
  type Offer {
    offerId: ID
    title: String
    description: String
  }
  type Query {
    key(productId: String, optionId: String, currency: String, unitsWithQuantity: [UnitWithQuantity], jwtKey: String): String
    dateTimeStart: String
    dateTimeEnd: String
    allDay: Boolean
    vacancies: Int
    available: Boolean
    pricing: Pricing
    unitPricing: [Pricing]
    offer: Offer
  }
`;

const query = `query getAvailability ($pId: String, $oId: String, $currency: String, $unitsWithQuantity: [UnitWithQuantity], $jwtKey: String) {
  key (productId: $pId, optionId: $oId, currency: $currency, unitsWithQuantity: $unitsWithQuantity, jwtKey: $jwtKey)
  dateTimeStart
  dateTimeEnd
  allDay
  vacancies
  available
  pricing {
    ...pricingFields
  }
  unitPricing {
    ...pricingFields
  }
  offer {
    offerId
    title
    description
  }
}
fragment pricingFields on Pricing {
  unitId
  original
  retail
  net
  currencyPrecision
}
`;

const resolvers = {
  Query: {
    key: (root, args) => {
      const {
        productId,
        optionId,
        currency,
        unitsWithQuantity,
        jwtKey,
      } = args;
      if (!jwtKey) return null;
      return jwt.sign(({
        productId,
        optionId,
        availabilityId: root.pk,
        currency,
        customers: unitsWithQuantity.map(u => {
          const foundCustomerTypeRate = root.customer_type_rates.find(c => `${R.path(['customer_prototype', 'pk'], c)}` === `${u.unitId}`) || {};
          return {
            customer_type_rate: foundCustomerTypeRate.pk,
          };
        }).filter(c => c.customer_type_rate),
      }), jwtKey);
    },
    dateTimeStart: root => R.path(['start_at'], root),
    dateTimeEnd: root => R.path(['end_at'], root),
    allDay: () => false,
    vacancies: R.prop('capacity'),
    available: () => true,
    // get the starting price
    pricing: root => {
      // sort ascending
      const sorted = R.sort(R.ascend(R.path(['customer_prototype', 'total_including_tax'])), root.customer_type_rates);
      return sorted[0];
    },
    unitPricing: root => R.path(['customer_type_rates'], root),
  },
  Pricing: {
    unitId: R.path(['customer_prototype', 'pk']),
    original: R.path(['customer_prototype', 'total_including_tax']),
    retail: R.path(['customer_prototype', 'total_including_tax']),
    net: R.path(['customer_prototype', 'total_including_tax']),
    currencyPrecision: () => 2,
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

const translateAvailability = async ({ rootValue, variableValues }) => {
  const retVal = await graphql({
    schema,
    rootValue,
    source: query,
    variableValues,
  });
  if (retVal.errors) throw new Error(retVal.errors);
  return retVal.data;
};
module.exports = {
  translateAvailability,
};
