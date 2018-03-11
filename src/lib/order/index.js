'use strict';

const deliveryType = require('./delivery-type');
const checkout = require('./checkout');
const status = require('./order-status');
const promotionalCode = require('./promotional-code');

const handlers = require('./handlers');
const validate = require('./validate');

const { id } = require('~/utils/validate');

exports.register = (server, options, next) => {
  server.route([
    ...deliveryType,
    ...checkout,
    ...status,
    ...promotionalCode,
    {
      method: 'POST',
      path: '/orders',
      handler: handlers.createOrder,
      config: { validate: { payload: validate.newOrder } },
    },
    {
      method: 'GET',
      path: '/orders/user/{userId}',
      handler: handlers.getUserOrders,
      config: { validate: { params: { userId: id } } },
    },
    {
      method: 'GET',
      path: '/orders/packing',
      handler: handlers.getAllPackingOrder,
    },
    {
      method: 'GET',
      path: '/orders/history',
      handler: handlers.getAllHistoryOrder,
      config: { validate: { query: validate.historyQuery } },
    },
    {
      method: 'GET',
      path: '/orders/delivery',
      handler: handlers.getAllDeliveryOrder,
    },
    {
      method: 'GET',
      path: '/orders/pending',
      handler: handlers.getAllPendingOrder,
    },
    {
      method: 'GET',
      path: '/orders/count',
      handler: handlers.getCountOrders,
    },
    {
      method: 'GET',
      path: '/orders/{orderId}',
      handler: handlers.getOrderDetail,
      config: { validate: { params: { orderId: id } } },
    },
    {
      method: 'PUT',
      path: '/orders/{orderId}/status',
      handler: handlers.setOrderStatus,
      config: {
        validate: {
          payload: validate.status,
          params: { orderId: id },
        },
      },
    },
    {
      method: 'GET',
      path: '/orders/processing',
      handler: handlers.getAllProcessingOrder,
    },
    {
      method: 'GET',
      path: '/orders/{orderId}/status',
      handler: handlers.getOrderStatus,
      config: { validate: { params: { orderId: id } } },
    },
  ]);

  next();
};

exports.register.attributes = {
  name: 'OrderPlugin',
  version: '1.0.0',
};
