'use strict';

const handlers = require('./handlers');
const validate = require('./validate');
const { id } = require('~/utils/validate');

const telephoneRoutes = require('./telephone');
const addressRoutes = require('./address');
const invoiceRoutes = require('./invoice');

exports.register = (server, options, next) => {
  server.route([
    ...telephoneRoutes,
    ...addressRoutes,
    ...invoiceRoutes,
    {
      method: 'POST',
      path: '/login',
      handler: handlers.login,
      config: {
        auth: false,
        validate: {
          payload: validate.login,
        },
      },
    },
    {
      method: 'GET',
      path: '/logout',
      handler: handlers.logout,
    },
    {
      method: 'POST',
      path: '/signup',
      handler: handlers.signupUser,
      config: {
        auth: false,
        validate: {
          payload: validate.signupUser,
        },
      },
    },
    {
      method: 'GET',
      path: '/users/{id}',
      handler: handlers.getUser,
      config: {
        validate: {
          params: {
            id,
          },
        },
      },
    },
    {
      method: 'GET',
      path: '/users',
      handler: handlers.getAllUsers,
    },
    {
      method: 'PUT',
      path: '/users/{userId}',
      handler: handlers.updateUser,
      config: {
        validate: {
          params: { userId: id },
          payload: validate.updateUser,
        },
      },
    },
    {
      method: 'POST',
      path: '/users/recover-password',
      handler: handlers.recoverPwd,
      config: {
        auth: false,
        validate: {
          payload: validate.recoverPwd,
        },
      },
    },
    {
      method: 'POST',
      path: '/users/create-password',
      handler: handlers.createUserPwd,
      config: {
        auth: false,
        validate: {
          payload: validate.createUserPwd,
        },
      },
    },
    {
      method: 'DELETE',
      path: '/users/{id}',
      handler: handlers.deleteUser,
      config: {
        validate: {
          params: {
            id,
          },
        },
      },
    },
  ]);

  next();
};

exports.register.attributes = {
  name: 'UserPlugin',
  version: '1.0.0',
};
