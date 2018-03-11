'use strict';

const handlers = require('./handlers');

module.exports = [
  {
    method: 'GET',
    path: '/order-statuses/checkout',
    handler: handlers.getCheckoutStatuses,
  },
];
