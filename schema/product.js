const { makeExecutableSchema } = require('@graphql-tools/schema');
const R = require('ramda');
const { graphql } = require('graphql');

const typeDefs = `
  type Restriction {
    paxCount: Int
    minAge: Int
    maxAge: Int
  }
  type Pricing {
    original: Int
    retail: Int
    currency: Int
    currencyPrecision: Int
  }
  type Unit {
    unitId: ID
    unitName: String
    subtitle: String!
    restrictions: Restriction
    pricing: [Pricing]
  }
  type Option {
    optionId: ID
    optionName: String
    units: [Unit]
  }
  type Query {
    productId: ID
    productName: String
    availableCurrencies: [String]
    defaultCurrency: String
    options: [Option]
  }
`;

const query = `{
  productId
  productName
  availableCurrencies
  defaultCurrency
  options {
    optionId
    optionName
    units {
      unitId
      unitName
      subtitle
      pricing {
        original
        retail
        currencyPrecision
        currency
      }
      restrictions {
        paxCount
        minAge
        maxAge
      }
    }
  }
}`;

const resolvers = {
  Query: {
    productId: R.path(['pk']),
    productName: R.path(['name']),
    availableCurrencies: obj => R.path(['company', 'currency'], obj) ? [R.path(['company', 'currency'], obj)] : [],
    defaultCurrency: R.path(['company', 'currency']),
    options: item => [{
      pk: 'default',
      display_name: R.path(['name'], item),
      units: R.pathOr([], ['customer_prototypes'], item),
    }],
  },
  Option: {
    optionId: R.path(['pk']),
    optionName: R.path(['display_name']),
    units: option => R.pathOr([], ['units'], option),
  },
  Unit: {
    unitId: R.path(['pk']),
    unitName: R.path(['display_name']),
    subtitle: R.path(['note']),
    pricing: root => [{
      original: R.path(['total_including_tax'], root),
      retail: R.path(['total_including_tax'], root),
      currencyPrecision: 2,
      currency: R.path(['company', 'currency'], root),
    }],
    restrictions: unit => {
      const retVal = { paxCount: 1 };
      if (unit.note.indexOf('All ages') > -1) {
        retVal.minAge = 0;
        retVal.maxAge = 99;
      } else if (unit.note) {
        // note could be: 18+, 1-17 yrs, 60+
        if (unit.note === '18+') {
          retVal.minAge = 18;
          retVal.maxAge = 59;
        }
        if (unit.note === '60+') {
          retVal.minAge = 60;
          retVal.maxAge = 99;
        }
        if (unit.note.indexOf('-') > -1) {
          retVal.minAge = unit.note.split('-')[0];
          retVal.maxAge = unit.note.split('-')[1].replace(' yrs', '');
        }
      }
      if (isNaN(retVal.minAge)) retVal.minAge = 0;
      if (isNaN(retVal.maxAge)) retVal.maxAge = 99;
      return retVal;
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const translateProduct = async ({ rootValue }) => {
  const retVal = await graphql({
    schema,
    rootValue,
    source: query,
  });
  if (retVal.errors) throw new Error(retVal.errors);
  return retVal.data;
};

module.exports = {
  translateProduct,
};
