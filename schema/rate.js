const { makeExecutableSchema } = require('@graphql-tools/schema');
const R = require('ramda');
const { graphql } = require('graphql');

const typeDefs = `
  type Pricing {
    original: Int
    retail: Int
    currency: Int
    currencyPrecision: Int
  }
  type Query {
    rateId: ID
    rateName: String
    unitId: ID
    unitName: String
    pricing: [Pricing]
  }
`;

const query = `{
  rateId
  rateName
  unitId
  unitName
  pricing {
    original
    retail
    currencyPrecision
    currency
  }
}`;

const resolvers = {
  Query: {
    rateId: R.path(['unitId']),
    rateName: root => R.toLower(R.path(['unitName'], root)),
    pricing: root => [{
      original: R.path(['total_including_tax'], root),
      retail: R.path(['total_including_tax'], root),
      currencyPrecision: 2,
      currency: R.path(['company', 'currency'], root),
    }],
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const translateRate = async ({ rootValue }) => {
  const retVal = await graphql({
    schema,
    rootValue,
    source: query,
  });
  if (retVal.errors) throw new Error(retVal.errors);
  return retVal.data;
};

module.exports = {
  translateRate,
};
