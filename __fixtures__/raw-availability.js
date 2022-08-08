module.exports = {
  pk: 35887202,
  start_at: '2022-08-18T15:30:00+1000',
  end_at: '2022-08-18T15:30:00+1000',
  capacity: 35,
  minimum_party_size: 1,
  maximum_party_size: null,
  customer_type_rates: [
    {
      pk: 2525776286,
      capacity: 35,
      minimum_party_size: null,
      maximum_party_size: null,
      customer_type: { pk: 53743, singular: 'Adult', plural: 'Adults', note: '18+' },
      customer_prototype: {
        pk: 75992,
        display_name: 'Adult',
        note: '18+',
        total: 3182,
        total_including_tax: 3500
      }
    },
    {
      pk: 2525776287,
      capacity: 35,
      minimum_party_size: 2,
      maximum_party_size: 4,
      customer_type: {
        pk: 53744,
        singular: 'Child',
        plural: 'Children',
        note: '0-17 yrs'
      },
      customer_prototype: {
        pk: 75993,
        display_name: 'Child',
        note: '0-17 yrs',
        total: 2273,
        total_including_tax: 2500
      }
    },
    {
      pk: 2525776288,
      capacity: 35,
      minimum_party_size: null,
      maximum_party_size: null,
      customer_type: {
        pk: 53747,
        singular: 'Senior',
        plural: 'Seniors',
        note: '60+'
      },
      customer_prototype: {
        pk: 76013,
        display_name: 'Senior',
        note: '60+',
        total: 2273,
        total_including_tax: 2500
      }
    }],
  effective_cancellation_policy: { type: 'hours-before-start', cutoff: '2022-08-18T15:30:00+1000' }
};