'use strict';

const Boom = require('boom');
const moment = require('moment');

module.exports = {
  validatePromotionalCode,
};

function validatePromotionalCode(db, code, userId) {
  const { PromotionalCode, PromotionalCodeType, Order, OrderStatus } = db.getModels();

  let promoCode = null;

  const promise = PromotionalCode.findOne({
    where: { code },
    include: [{ model: Order, as: 'orders' }],
  })
    .then(promoCodeDb => {
      if (!promoCodeDb) {
        throw Boom.notFound(`Le code promo n'existe pas. Code : ${code}`);
      }

      promoCode = promoCodeDb.toJSON();

      let ordersCount = 0;

      if (promoCode.typeId === PromotionalCodeType.PER_USER) {
        // Check previous orders of the user.
        ordersCount = promoCode.orders.filter(
          order =>
            order.promotionalCodeId === promoCode.id &&
            order.statusId !== OrderStatus.CANCELED &&
            order.userId === userId
        ).length;
      } else {
        // Global - Check all orders
        ordersCount = promoCode.orders.filter(
          order =>
            order.promotionalCodeId === promoCode.id && order.statusId !== OrderStatus.CANCELED
        ).length;
      }

      if (
        promoCode.usageLimit &&
        promoCode.usageLimit !== null &&
        ordersCount >= promoCode.usageLimit
      ) {
        throw Boom.forbidden(
          `Vous n'avez pas le droit d'utiliser ce code, sa limite d'utilisation a déjà été atteinte.`
        );
      }

      if (promoCode.expirationDate && promoCode.expirationDate !== null) {
        if (
          moment().tz('Europe/Paris').isAfter(moment(promoCode.expirationDate).tz('Europe/Paris'))
        ) {
          throw Boom.forbidden(`Vous ne pouvez plus utiliser ce code, il a expiré.`);
        }
      }

      if (
        promoCode.firstOrderOnly &&
        promoCode.firstOrderOnly !== null &&
        promoCode.firstOrderOnly === true
      ) {
        return Order.findAll({ where: { userId } });
      }

      return [];
    })
    .then(orders => {
      if (orders.length > 0) {
        throw Boom.forbidden(
          `Vous n'avez pas le droit d'utiliser ce code, il ne peut être utilisé qu'à la première commande.`
        );
      }

      return promoCode;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return promise;
}
