'use strict';

const handlers = require('./handlers.js');
const validate = require('./validate.js');
const { id } = require('~/utils/validate.js');

module.exports = [
  {
    method: 'GET',
    path: '/users/{userId}/phones',
    handler: handlers.getPhones,
    config: {
      validate: {
        params: {
          userId: id,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/users/{userId}/phones',
    handler: handlers.createPhone,
    config: {
      validate: {
        payload: validate.newPhone,
        params: {
          userId: id,
        },
      },
    },
  },
  {
    method: 'PUT',
    path: '/users/{userId}/phones/{phoneId}',
    handler: handlers.updatePhone,
    config: {
      validate: {
        payload: validate.phone,
        params: {
          userId: id,
          phoneId: id,
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/users/{userId}/phones/{phoneId}',
    handler: handlers.deletePhone,
    config: {
      validate: {
        params: {
          userId: id,
          phoneId: id,
        },
      },
    },
  },
];
