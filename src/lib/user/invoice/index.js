'use strict';

const handlers = require('./handlers');
const { id } = require('~/utils/validate.js');

module.exports = [
  {
    method: 'GET',
    path: '/users/{userId}/invoices/{invoiceId}',
    handler: handlers.getUserInvoice,
    config: {
      validate: {
        params: {
          userId: id,
          invoiceId: id,
        },
      },
    },
  },
];
