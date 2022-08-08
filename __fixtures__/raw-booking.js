module.exports = {
  "pk": 344488,
  "uuid": "4509eb05-79cb-405d-8aba-e1d0edaef309",
  "availability": {
    "pk": 35887201,
    "start_at": "2022-08-18T12:00:00+1000",
    "end_at": "2022-08-18T12:00:00+1000",
    "capacity": 34,
    "minimum_party_size": 1,
    "maximum_party_size": null,
    "customer_type_rates": [
      {
        "pk": 2525776283,
        "capacity": 34,
        "minimum_party_size": null,
        "maximum_party_size": null,
        "customer_type": {
          "pk": 53743,
          "singular": "Adult",
          "plural": "Adults",
          "note": "18+"
        },
        "customer_prototype": {
          "pk": 75992,
          "display_name": "Adult",
          "note": "18+",
          "total": 3182,
          "total_including_tax": 3500
        },
        "total": 3182,
        "total_including_tax": 3500,
        "custom_field_instances": []
      },
      {
        "pk": 2525776284,
        "capacity": 34,
        "minimum_party_size": 2,
        "maximum_party_size": 4,
        "customer_type": {
          "pk": 53744,
          "singular": "Child",
          "plural": "Children",
          "note": "0-17 yrs"
        },
        "customer_prototype": {
          "pk": 75993,
          "display_name": "Child",
          "note": "0-17 yrs",
          "total": 2273,
          "total_including_tax": 2500
        },
        "total": 2273,
        "total_including_tax": 2500,
        "custom_field_instances": []
      },
      {
        "pk": 2525776285,
        "capacity": 34,
        "minimum_party_size": null,
        "maximum_party_size": null,
        "customer_type": {
          "pk": 53747,
          "singular": "Senior",
          "plural": "Seniors",
          "note": "60+"
        },
        "customer_prototype": {
          "pk": 76013,
          "display_name": "Senior",
          "note": "60+",
          "total": 2273,
          "total_including_tax": 2500
        },
        "total": 2273,
        "total_including_tax": 2500,
        "custom_field_instances": []
      }
    ],
    "item": {
      "pk": 32439,
      "name": "Daily Cruise Tour"
    },
    "headline": "",
    "custom_field_instances": [
      {
        "pk": 123721,
        "custom_field": {
          "modifier_kind": "offset",
          "modifier_type": "adjust",
          "offset": 1500,
          "percentage": 0,
          "is_taxable": true,
          "is_always_per_customer": true,
          "pk": 98626,
          "type": "yes-no",
          "is_required": false,
          "description": "",
          "description_safe_html": "",
          "name": "Check this box if you would like to add lunch to your activity (price per person)",
          "title": "Check this box if you would like to add lunch to your activity (price per person)",
          "booking_notes": "",
          "booking_notes_safe_html": ""
        }
      },
      {
        "pk": 123717,
        "custom_field": {
          "modifier_kind": "offset",
          "modifier_type": "none",
          "offset": 0,
          "percentage": 0,
          "is_taxable": true,
          "is_always_per_customer": false,
          "pk": 98621,
          "type": "long",
          "is_required": false,
          "description": "Any additional notes or requests?",
          "description_safe_html": "<p>Any additional notes or requests?</p>",
          "name": "Comments",
          "title": "Comments",
          "booking_notes": "",
          "booking_notes_safe_html": ""
        }
      },
      {
        "pk": 123718,
        "custom_field": {
          "modifier_kind": "offset",
          "modifier_type": "none",
          "offset": 0,
          "percentage": 0,
          "is_taxable": true,
          "is_always_per_customer": false,
          "pk": 98624,
          "type": "extended-option",
          "is_required": false,
          "description": "",
          "description_safe_html": "",
          "name": "How did you hear about us?",
          "title": "How did you hear about us?",
          "booking_notes": "",
          "booking_notes_safe_html": "",
          "extended_options": [
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835187,
              "name": "Internet search",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835188,
              "name": "Yelp",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835189,
              "name": "TripAdvisor",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835190,
              "name": "Google",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835191,
              "name": "Facebook",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835192,
              "name": "Instagram",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835193,
              "name": "Twitter",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835194,
              "name": "Friend",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835195,
              "name": "Word of mouth",
              "description": "",
              "description_safe_html": ""
            },
            {
              "modifier_kind": "offset",
              "modifier_type": "none",
              "offset": 0,
              "percentage": 0,
              "is_taxable": true,
              "is_always_per_customer": false,
              "pk": 835196,
              "name": "Other",
              "description": "",
              "description_safe_html": ""
            }
          ]
        }
      }
    ]
  },
  "company": {
    "name": "Discover Sydney Cruises",
    "shortname": "discoversydneycruises-api-testing",
    "currency": "aud"
  },
  "affiliate_company": {
    "name": "TourConnect",
    "shortname": "tourconnect",
    "currency": "aud"
  },
  "contact": {
    "name": "y y",
    "phone": "2548558454",
    "phone_country": "",
    "normalized_phone": "+12548558454",
    "language": "en-au",
    "email": "y@y.com",
    "is_subscribed_for_email_updates": false
  },
  "customers": [
    {
      "pk": 1049262,
      "checkin_url": "https://d.fhchk.co/4oXA",
      "checkin_status": null,
      "customer_type_rate": {
        "pk": 2525776283,
        "capacity": 34,
        "minimum_party_size": null,
        "maximum_party_size": null,
        "customer_type": {
          "pk": 53743,
          "singular": "Adult",
          "plural": "Adults",
          "note": "18+"
        },
        "customer_prototype": {
          "pk": 75992,
          "display_name": "Adult",
          "note": "18+",
          "total": 3182,
          "total_including_tax": 3500
        },
        "total": 3182,
        "total_including_tax": 3500
      },
      "custom_field_values": []
    }
  ],
  "invoice_price": 0,
  "invoice_price_display": "0.00",
  "display_id": "#344488",
  "external_id": "",
  "order": null,
  "status": "booked",
  "rebooked_from": null,
  "rebooked_to": null,
  "confirmation_url": "https://demo.fareharbor.com/embeds/book/discoversydneycruises-api-testing/items/32439/booking/4509eb05-79cb-405d-8aba-e1d0edaef309/",
  "custom_field_values": [
    {
      "pk": 791933,
      "custom_field": {
        "modifier_kind": "offset",
        "modifier_type": "adjust",
        "offset": 1500,
        "percentage": 0,
        "is_taxable": true,
        "is_always_per_customer": true,
        "pk": 98626,
        "type": "yes-no",
        "is_required": false,
        "description": "",
        "description_safe_html": "",
        "name": "Check this box if you would like to add lunch to your activity (price per person)",
        "title": "Check this box if you would like to add lunch to your activity (price per person)",
        "booking_notes": "",
        "booking_notes_safe_html": ""
      },
      "name": "Check this box if you would like to add lunch to your activity (price per person)",
      "value": "",
      "display_value": "No"
    },
    {
      "pk": 791934,
      "custom_field": {
        "modifier_kind": "offset",
        "modifier_type": "none",
        "offset": 0,
        "percentage": 0,
        "is_taxable": true,
        "is_always_per_customer": false,
        "pk": 98621,
        "type": "long",
        "is_required": false,
        "description": "Any additional notes or requests?",
        "description_safe_html": "<p>Any additional notes or requests?</p>",
        "name": "Comments",
        "title": "Comments",
        "booking_notes": "",
        "booking_notes_safe_html": ""
      },
      "name": "Comments",
      "value": "",
      "display_value": ""
    },
    {
      "pk": 791935,
      "custom_field": {
        "modifier_kind": "offset",
        "modifier_type": "none",
        "offset": 0,
        "percentage": 0,
        "is_taxable": true,
        "is_always_per_customer": false,
        "pk": 98624,
        "type": "extended-option",
        "is_required": false,
        "description": "",
        "description_safe_html": "",
        "name": "How did you hear about us?",
        "title": "How did you hear about us?",
        "booking_notes": "",
        "booking_notes_safe_html": "",
        "extended_options": [
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835187,
            "name": "Internet search",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835188,
            "name": "Yelp",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835189,
            "name": "TripAdvisor",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835190,
            "name": "Google",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835191,
            "name": "Facebook",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835192,
            "name": "Instagram",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835193,
            "name": "Twitter",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835194,
            "name": "Friend",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835195,
            "name": "Word of mouth",
            "description": "",
            "description_safe_html": ""
          },
          {
            "modifier_kind": "offset",
            "modifier_type": "none",
            "offset": 0,
            "percentage": 0,
            "is_taxable": true,
            "is_always_per_customer": false,
            "pk": 835196,
            "name": "Other",
            "description": "",
            "description_safe_html": ""
          }
        ]
      },
      "name": "How did you hear about us?",
      "value": "",
      "display_value": ""
    }
  ],
  "voucher_number": "",
  "receipt_subtotal": 3182,
  "receipt_subtotal_display": "31.82",
  "receipt_taxes": 318,
  "receipt_taxes_display": "3.18",
  "receipt_total": 3500,
  "receipt_total_display": "35.00",
  "amount_paid": 3500,
  "amount_paid_display": "35.00",
  "note": "",
  "note_safe_html": "",
  "pickup": null,
  "arrival": null,
  "is_eligible_for_cancellation": true,
  "effective_cancellation_policy": {
    "type": "hours-before-start",
    "cutoff": "2022-08-18T12:00:00+1000"
  },
  "is_subscribed_for_sms_updates": false,
  "agent": null,
  "desk": null,
  "dashboard_url": "https://demo.fareharbor.com/discoversydneycruises-api-testing/dashboard/?overlay=/contacts/293106/bookings/4509eb05-79cb-405d-8aba-e1d0edaef309/",
  "customer_count": 1
};
