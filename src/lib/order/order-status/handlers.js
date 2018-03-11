'use strict';

const Boom = require('boom');

module.exports = {
  getCheckoutStatuses,
};

function getCheckoutStatuses(request, reply) {
  const db = request.getDb();
  const OrderStatus = db.getModel('OrderStatus');

  const promise = OrderStatus.findAll({
    where: {
      id: {
        $in: [
          OrderStatus.PENDING,
          OrderStatus.PROCESSING,
          OrderStatus.PACKING,
          OrderStatus.DELIVERY,
        ],
      },
    },
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}
