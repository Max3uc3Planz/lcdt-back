'use strict';

const handlers = require('./handlers');
const validate = require('./validate');
const utilsValidate = require('~/utils/validate');

module.exports = [
  {
    method: 'GET',
    path: '/delivery-types',
    handler: handlers.getDeliveryTypes,
    config: {
      auth: false,
    },
  },
  {
    method: 'GET',
    path: '/delivery-types/{id}',
    handler: handlers.getDeliveryType,
    config: {
      auth: false,
      validate: {
        params: {
          id: utilsValidate.id,
        },
      },
    },
  },
  {
    method: 'PUT',
    path: '/delivery-types/{dtId}',
    handler: handlers.updateDeliveryType,
    config: {
      validate: {
        params: { dtId: utilsValidate.id },
        payload: validate.updateDeliveryType,
      },
    },
  },
];
