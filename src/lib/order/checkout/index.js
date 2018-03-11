'use strict';

const handlers = require('./handlers');
const validate = require('./validate');
const { id } = require('~/utils/validate');

module.exports = [
  {
    method: 'GET',
    path: '/checkout/product/{id}/available/{qty}',
    handler: handlers.checkProductAvailability,
    config: {
      validate: {
        params: {
          id,
          qty: id,
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/checkout/address',
    handler: handlers.checkIsAddressInZones,
    config: {
      validate: {
        query: {
          longitude: validate.longitude,
          latitude: validate.latitude,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/checkout/timeslot',
    handler: handlers.checkTimeSlot,
    config: {
      validate: {
        payload: validate.timeslot,
      },
    },
  },
  {
    method: 'POST',
    path: '/checkout/timeslot/test/{date}',
    handler: handlers.checkTimeSlotTest,
    config: {
      validate: {
        payload: validate.timeslot,
        params: {
          date: validate.test,
        },
      },
    },
  },
];
