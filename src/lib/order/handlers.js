'use strict';

const Boom = require('boom');
const moment = require('moment');
const q = require('q');
const { resolve } = require('path');
const templater = require('~/utils/templater');
const config = require('~/config');

const {
  checkProductIsAvailable,
  checkAddressInZones,
  checkTimeSlotAvailability,
  isSponsorshipCodeValid,
} = require('./checkout/functions');

const { validatePromotionalCode } = require('./promotional-code/functions');
const { isAddressInZones, getZoneFromAddress } = require('~/utils/address');
const htmlToPDF = require('~/utils/html-pdf/');

module.exports = {
  createOrder,
  getAllPackingOrder,
  getAllDeliveryOrder,
  getUserOrders,
  getOrderDetail,
  getAllHistoryOrder,
  getAllProcessingOrder,
  setOrderStatus,
  getAllPendingOrder,
  getCountOrders,
  getOrderStatus,
};

function createOrder(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const {
    Telephone,
    Address,
    Order,
    OrderItem,
    OrderStatus,
    DeliveryZone,
    DeliveryType,
    Product,
    Setting,
    SponsorshipDiscount,
    User,
  } = db.getModels();
  const { id } = request.auth.credentials;
  const orderData = request.payload;
  let orderSave;

  const promise = sequelize
    .transaction(transaction => {
      let addressPromise = null;
      let dbAddress = null;
      let orderItemsDb = null;
      let newOrderId = -1;
      let globalSettings = null;
      let promoCode = null;
      let sponsorshipCode = null;

      let total = 0;
      let totalTax = 0;

      if (orderData.addressId) {
        addressPromise = Address.findOne({ where: { id: orderData.addressId, userId: id } });
      } else {
        addressPromise = DeliveryZone.findAll().then(deliveryZones => {
          if (!isAddressInZones(orderData.address.lat, orderData.address.lng, deliveryZones)) {
            throw Boom.badData(
              `L'adresse doit être située dans une des zones de livraison déservies.`
            );
          }

          orderData.address.userId = id;
          return Address.create(orderData.address, { transaction });
        });
      }

      const innerPromise = addressPromise
        .then(address => {
          if (!address) {
            throw Boom.notFound(
              `L'adresse fournie pour la commande n'a pas été enregistrée ou n'appartient pas à l'utilisateur courant !`
            );
          }

          const jsonAddress = address.toJSON();
          dbAddress = jsonAddress;

          return checkAddressInZones(db, jsonAddress.lat, jsonAddress.lng);
        })
        .then(() => Telephone.findOne({ where: { id: orderData.telephone, userId: id } }))
        .then(telephone => {
          if (!telephone) {
            throw Boom.notFound(
              `Le téléphone fourni pour la commande n'a pas été enregistré ou n'appartient pas à l'utilisateur courant !`
            );
          }

          const timeslot = {
            weekDay: orderData.weekDay,
            deliveryType: orderData.deliveryType,
            timeMin: orderData.timeMin,
            timeMax: orderData.timeMax,
          };

          return checkTimeSlotAvailability(db, moment().tz('Europe/Paris'), timeslot);
        })
        .then(() => Setting.findOne({ where: { id: 1 } }))
        .then(settings => {
          globalSettings = settings.toJSON();

          if (orderData.sponsorshipCode && settings.sponsorshipActive) {
            return isSponsorshipCodeValid(db, orderData.sponsorshipCode, id).then(code => {
              sponsorshipCode = code;
            });
          } else if (orderData.promoCode) {
            return validatePromotionalCode(db, orderData.promoCode, id).then(code => {
              promoCode = code;
            });
          }

          return null;
        })
        .then(() => {
          const productPromises = [];
          orderData.items.forEach(({ productId, qty }) => {
            productPromises.push(checkProductIsAvailable(db, productId, qty));
          });

          return q.all(productPromises);
        })
        .then(productResults => {
          const orderItemPromises = [];
          productResults.forEach(({ product, qty }) => {
            orderItemPromises.push(
              OrderItem.create(
                {
                  name: product.title,
                  quantity: qty,
                  total: product.price * qty,
                  totalTax: product.priceTax * qty,
                  shortDescription: product.shortDescription,
                  pictureUrl: product.pictureUrl,
                  productId: product.id,
                },
                { transaction }
              ).then(item =>
                Product.update(
                  { currentStock: product.currentStock - qty },
                  { where: { id: product.id }, transaction }
                ).then(() => item)
              )
            );
          });

          return q.all(orderItemPromises);
        })
        .then(newOrderItems => {
          orderItemsDb = newOrderItems;

          newOrderItems.forEach(modelItem => {
            const item = modelItem.toJSON();

            total += item.total;
            totalTax += item.totalTax;
          });

          if (totalTax < globalSettings.minOrderPrice) {
            throw Boom.badData(
              `Le montant minimum de la commande est : ${globalSettings.minOrderPrice}€.`
            );
          }

          let tslotMin = moment(moment().tz('Europe/Paris'));
          let tslotMax = moment(moment().tz('Europe/Paris'));

          if (orderData.deliveryType === DeliveryType.EARLY) {
            tslotMin.day(orderData.weekDay);
            tslotMax.day(orderData.weekDay);

            const startHours = Math.floor(orderData.timeMin / 100);
            const endHours = Math.floor(orderData.timeMax / 100);

            tslotMin.hour(startHours);
            tslotMin.minute(orderData.timeMin - startHours * 100);

            tslotMax.hour(endHours);
            tslotMax.minute(orderData.timeMax - endHours * 100);
          }

          tslotMin = tslotMin.toDate();
          tslotMax = tslotMax.toDate();

          const newOrderData = {
            date: moment(moment().tz('Europe/Paris')).toDate(),
            paymentMethod: orderData.paymentMethod,
            statusId: OrderStatus.PENDING,
            deliveryTypeId: orderData.deliveryType,
            addressId: dbAddress.id,
            userId: id,
            telephoneId: orderData.telephone,
            discount: 0,
            discountTax: 0,
            tslotMin,
            tslotMax,
          };

          if (promoCode !== null) {
            newOrderData.promotionalCodeId = promoCode.id;
            const { discount, discountTax } = getPromoCodeDiscountAmount(
              promoCode,
              total,
              totalTax
            );
            newOrderData.discount = discount;
            newOrderData.discountTax = discountTax;
          } else if (sponsorshipCode !== null) {
            newOrderData.sponsorshipCodeId = sponsorshipCode.id;
            newOrderData.discount = globalSettings.sponsorshipAmount;
            newOrderData.discountTax = globalSettings.sponsorshipAmountTax;
          }

          total -= newOrderData.discount;
          totalTax -= newOrderData.discountTax;

          newOrderData.total = total;
          newOrderData.totalTax = totalTax;

          return Order.create(newOrderData, { transaction });
        })
        .then(newOrder => {
          const itemPromises = [];
          newOrderId = newOrder.get('id');

          orderItemsDb.forEach(itemDb => {
            itemPromises.push(newOrder.addItem(itemDb, { transaction }));
          });

          return q.all(itemPromises);
        })
        .then(() => calculateDeliveryCost(db, orderData.deliveryType, dbAddress))
        .then(deliveryCosts =>
          Order.update(
            {
              deliveryCost: deliveryCosts.vatExcl,
              deliveryCostTax: deliveryCosts.vatIncl,
              total: total + deliveryCosts.vatExcl,
              totalTax: totalTax + deliveryCosts.vatIncl,
            },
            { where: { id: newOrderId }, transaction }
          )
        )
        .then(() => {
          if (sponsorshipCode !== null) {
            // Updates the sponsorshipCode in order to consume it so it can't be used twice.
            return SponsorshipDiscount.update(
              { consumed: true },
              { where: { id: sponsorshipCode.id }, transaction }
            );
          }

          return null;
        })
        .then(() =>
          Order.findOne({
            where: { id: newOrderId },
            include: [
              { model: DeliveryType, as: 'deliveryType' },
              { model: Address, as: 'deliveryAddress' },
              { model: Telephone, as: 'telephone' },
              { model: OrderStatus, as: 'status' },
              { model: OrderItem, as: 'items' },
              {
                model: User,
                as: 'user',
                attributes: { exclude: ['password', 'createdAt', 'updatedAt'] },
              },
            ],
            transaction,
          })
        )
        .then(order => {
          if (request.socket) {
            request.socket.sockets.in('mda_room').emit('order-created', { order });
          }
          orderSave = order;
          return order;
        });

      // DO NO DELETE !!!!!!!!!!!
      // .then(order =>
      //   request.smsClient
      //     .send({
      //       message: `Plateforme Cantine :\nNous avons enregistré votre commande #${order.id} et celle-ci est en attente de préparation`,
      //       receivers: [order.telephone.phone],
      //     })
      //     .then(({ messagesSent, invalidReceivers }) => {
      //       const response = { data: order };
      //       let smsWasSent = true;

      //       if (messagesSent !== 0) {
      //         console.error('Erreur nombre sms envoyé = ', messagesSent);
      //         smsWasSent = false;
      //       }

      //       if (invalidReceivers.length > 0) {
      //         console.error(`Erreur : Numéro d'envoi non valide`);
      //         smsWasSent = false;
      //       }

      //       if (smsWasSent === false) {
      //         response.error = `Erreur lors de l'envoi du SMS de validation`;
      //       }

      //       return response;
      //     })
      // );

      return innerPromise;
    })
    .then(order => createInvoice(order, request))
    .then(invoicePath => {
      if (invoicePath) {
        return orderSave.update({ invoiceUrl: invoicePath });
      }
      return null;
    })
    .then(() => {
      let expressEmail = false;
      let earlyEmail = false;

      if (orderSave.deliveryType.id === DeliveryType.EXPRESS) {
        expressEmail = true;
      } else {
        earlyEmail = true;
      }
      const templatePath = resolve(__dirname, 'templates', 'order-email.html');
      return templater.getCompiledHtml(templatePath, {
        userFirstname: orderSave.user.firstname,
        userLastname: orderSave.user.lastname,
        deliveryAddress1: orderSave.deliveryAddress.address1,
        deliveryAddressCity: orderSave.deliveryAddress.city,
        deliveryAddressZP: orderSave.deliveryAddress.zipcode,
        items: orderSave.items,
        subTotal: orderSave.totalTax - orderSave.discountTax - orderSave.deliveryCostTax,
        total: orderSave.totalTax,
        deliveryCost: orderSave.deliveryCostTax,
        discountCost: orderSave.discountTax,
        tslotDate: moment(orderSave.tslotMin).format('DD/MM/YYYY'),
        tslotMin: moment(orderSave.tslotMin).format('HH:mm'),
        tslotMax: moment(orderSave.tslotMax).format('HH:mm'),
        express: expressEmail,
        early: earlyEmail,
      });
    })
    .then(compiledHtml => {
      const params = {
        from: config.get('/mailer/transporter/auth/user'),
        to: orderSave.user.email,
        subject: 'Votre facture Cantine',
        html: compiledHtml,
        attachments: [
          {
            filename: 'logo.png',
            path: resolve(config.get('/publicImgFolder'), 'logo.png'),
            cid: 'logoCantine@mailLogo',
          },
          {
            filename: 'facture.pdf',
            path: orderSave.invoiceUrl,
          },
        ],
      };

      return request.mailer.sendMail(params);
    })
    .then(info => {
      if (info.accepted.length === 0) {
        request.log(
          ['error'],
          `Erreur lors de l'envoi de l'email de facture orderId : ${orderSave.id}.`
        );
      }
      return orderSave;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function getUserOrders(request, reply) {
  const userId = request.params.userId;
  const db = request.getDb();
  const { id, roleId } = request.auth.credentials;
  const {
    Order,
    UserRole,
    User,
    DeliveryType,
    Address,
    Telephone,
    OrderStatus,
    OrderItem,
  } = db.getModels();

  // We check if the user asking for the phones is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = User.findOne({ where: { id: userId } })
    .then(userInDb => {
      if (!userInDb) {
        throw Boom.notFound(`Utilisateur non existant. Id : ${userId}`);
      }

      return Order.findAll({
        where: { userId },
        include: [
          { model: DeliveryType, as: 'deliveryType' },
          { model: Address, as: 'deliveryAddress' },
          { model: Telephone, as: 'telephone' },
          { model: OrderStatus, as: 'status' },
          { model: OrderItem, as: 'items' },
        ],
      });
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function getAllPackingOrder(request, reply) {
  const db = request.getDb();
  const { UserRole, Order, OrderItem, OrderStatus, DeliveryType } = db.getModels();
  const { roleId } = request.auth.credentials;
  const sequelize = db.sequelize;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findAll({
    attributes: { include: [[sequelize.fn('SUM', sequelize.col('items.quantity')), 'orderQty']] },
    where: { statusId: OrderStatus.PACKING },
    include: [
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: DeliveryType, as: 'deliveryType' },
    ],
    order: [[{ model: OrderStatus, as: 'status' }, 'updatedAt', 'ASC']],
    group: ['Order.id', 'status.id', 'items.id', 'deliveryType.id'],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getAllHistoryOrder(request, reply) {
  const db = request.getDb();
  const { page, start, end } = request.query;
  const { UserRole, Order, OrderItem, OrderStatus, DeliveryType } = db.getModels();
  const { roleId } = request.auth.credentials;
  const limit = 25;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const where = {};
  if (typeof start !== 'undefined' || typeof end !== 'undefined') {
    if (typeof start !== 'undefined' && typeof end !== 'undefined') {
      where.$and = [{ date: { $between: [start, end] } }];
    } else if (typeof start !== 'undefined') {
      where.$and = [{ date: { $gte: start } }];
    } else if (typeof end !== 'undefined') {
      where.$and = [{ date: { $lte: end } }];
    }

    where.$and = [
      ...where.$and,
      { $or: [{ statusId: OrderStatus.FINISHED }, { statusId: OrderStatus.CANCELED }] },
    ];
  } else {
    where.$or = [{ statusId: OrderStatus.FINISHED }, { statusId: OrderStatus.CANCELED }];
  }

  const promise = Order.findAndCountAll({
    where,
    include: [
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: DeliveryType, as: 'deliveryType' },
    ],
    order: [['id', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getAllDeliveryOrder(request, reply) {
  const db = request.getDb();
  const { UserRole, Order, OrderItem, OrderStatus, DeliveryType } = db.getModels();
  const { roleId } = request.auth.credentials;
  const sequelize = db.sequelize;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findAll({
    attributes: { include: [[sequelize.fn('SUM', sequelize.col('items.quantity')), 'orderQty']] },
    where: { statusId: OrderStatus.DELIVERY },
    include: [
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: DeliveryType, as: 'deliveryType' },
    ],
    order: [[{ model: OrderStatus, as: 'status' }, 'updatedAt', 'ASC']],
    group: ['Order.id', 'status.id', 'items.id', 'deliveryType.id'],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getAllPendingOrder(request, reply) {
  const db = request.getDb();
  const { UserRole, Order, OrderItem, OrderStatus, DeliveryType } = db.getModels();
  const { roleId } = request.auth.credentials;
  const sequelize = db.sequelize;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findAll({
    attributes: { include: [[sequelize.fn('SUM', sequelize.col('items.quantity')), 'orderQty']] },
    where: { statusId: OrderStatus.PENDING },
    include: [
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: DeliveryType, as: 'deliveryType' },
    ],
    order: [['createdAt', 'DESC']],
    group: ['Order.id', 'status.id', 'items.id', 'deliveryType.id'],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getOrderDetail(request, reply) {
  const { orderId } = request.params;
  const db = request.getDb();
  const { id, roleId } = request.auth.credentials;
  const {
    Order,
    UserRole,
    User,
    DeliveryType,
    Address,
    Telephone,
    OrderStatus,
    OrderItem,
    PromotionalCode,
    SponsorshipDiscount,
  } = db.getModels();

  const promise = Order.findOne({
    where: { id: orderId },
    include: [
      { model: DeliveryType, as: 'deliveryType' },
      { model: Address, as: 'deliveryAddress' },
      { model: Telephone, as: 'telephone' },
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: PromotionalCode, as: 'promotionalCode' },
      { model: SponsorshipDiscount, as: 'sponsorshipCode' },
      {
        model: User,
        as: 'user',
        attributes: {
          exclude: [
            'password',
            'deleted',
            'username',
            'recoveryToken',
            'tokenExpiration',
            'createdAt',
            'updatedAt',
          ],
        },
      },
    ],
  })
    .then(order => {
      if (!order) {
        throw Boom.notFound(`La commande demandée n'existe pas. Id : ${orderId}`);
      }

      // We check if the user asking for the phones is the owner or an admin.
      if (order.userId !== id && roleId === UserRole.ROLE_USER) {
        throw Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette commande !`);
      }

      return order;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function getAllProcessingOrder(request, reply) {
  const db = request.getDb();
  const { UserRole, Order, OrderItem, OrderStatus, DeliveryType } = db.getModels();
  const { roleId } = request.auth.credentials;
  const sequelize = db.sequelize;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findAll({
    attributes: { include: [[sequelize.fn('SUM', sequelize.col('items.quantity')), 'orderQty']] },
    where: { statusId: OrderStatus.PROCESSING },
    include: [
      { model: OrderStatus, as: 'status' },
      { model: OrderItem, as: 'items' },
      { model: DeliveryType, as: 'deliveryType' },
    ],
    order: [['date', 'ASC']],
    group: ['Order.id', 'status.id', 'items.id', 'deliveryType.id'],
  })
    .then(orders => orders)
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function setOrderStatus(request, reply) {
  const { orderId } = request.params;
  const { newStatus } = request.payload;

  const db = request.getDb();
  const { UserRole, Order, OrderStatus } = db.getModels();
  const { roleId } = request.auth.credentials;

  let orderDb = null;
  let oldStatus = null;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findOne({ where: { id: orderId } })
    .then(order => {
      if (!order) {
        throw Boom.notFound(`La commande demandée n'existe pas. Id : ${orderId}`);
      }

      orderDb = order;
      oldStatus = order.statusId;

      return OrderStatus.findOne({ where: { id: newStatus } });
    })
    .then(status => {
      if (!status) {
        throw Boom.notFound(`Le statut spécifié est invalide.`);
      }

      if (!isNextStatusValid(orderDb.get('statusId'), status.get('id'), OrderStatus)) {
        throw Boom.badData(
          `La commande ne peut pas être passée dans le status spécifié. Statut : ${status.get(
            'label'
          )}.`
        );
      }

      return orderDb.setStatus(status).then(() => status);
    })
    .then(status => {
      const statusSlugsMap = {};
      statusSlugsMap[OrderStatus.PENDING] = 'pending';
      statusSlugsMap[OrderStatus.PROCESSING] = 'processing';
      statusSlugsMap[OrderStatus.PACKING] = 'packing';
      statusSlugsMap[OrderStatus.DELIVERY] = 'delivery';
      statusSlugsMap[OrderStatus.FINISHED] = 'finished';
      statusSlugsMap[OrderStatus.CANCELED] = 'canceled';

      request.socket.sockets.in('mda_room').emit('order-status-changed', {
        newStatus: statusSlugsMap[status.get('id')],
        oldStatus: statusSlugsMap[oldStatus],
        order: orderDb,
      });

      // if (order.get('statusId') === OrderStatus.DELIVERY) {
      //   return request.smsClient
      //     .send({
      //       message: `Plateforme Cantine :\nVotre commande #${order.get('id')} est en cours de livraison`,
      //       receivers: [order.telephone.phone],
      //     })
      //     .then(({ messagesSent, invalidReceivers }) => {
      //       const response = { data: order };
      //       let smsWasSent = true;

      //       if (messagesSent !== 0) {
      //         console.error('Erreur nombre sms envoyé = ', messagesSent);
      //         smsWasSent = false;
      //       }

      //       if (invalidReceivers.length > 0) {
      //         console.error(`Erreur : Numéro d'envoi non valide`);
      //         smsWasSent = false;
      //       }

      //       if (smsWasSent === false) {
      //         response.error = `Erreur lors de l'envoi du SMS de validation`;
      //       }

      //       return response;
      //     });
      // }

      // return { data: order };

      if (request.currentSocket) {
        request.currentSocket.emit('order-status-changed', {
          newStatus: status.toJSON(),
          order: orderDb,
        });
      }
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function getCountOrders(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { UserRole, Order, OrderStatus } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = Order.findAll({
    attributes: [[sequelize.fn('COUNT', sequelize.col('id')), 'count'], 'statusId'],
    group: ['statusId'],
  })
    .then(counts => {
      const statusSlugsMap = {};
      const result = {
        pending: 0,
        processing: 0,
        packing: 0,
        delivery: 0,
        finished: 0,
        canceled: 0,
      };

      statusSlugsMap[OrderStatus.PENDING] = 'pending';
      statusSlugsMap[OrderStatus.PROCESSING] = 'processing';
      statusSlugsMap[OrderStatus.PACKING] = 'packing';
      statusSlugsMap[OrderStatus.DELIVERY] = 'delivery';
      statusSlugsMap[OrderStatus.FINISHED] = 'finished';
      statusSlugsMap[OrderStatus.CANCELED] = 'canceled';

      counts.forEach(model => {
        const value = model.toJSON();
        const prop = statusSlugsMap[value.statusId];
        result[prop] = parseInt(value.count, 10);
      });

      return result;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function getOrderStatus(request, reply) {
  const { orderId } = request.params;

  const db = request.getDb();
  const { UserRole, Order, OrderStatus, DeliveryType } = db.getModels();
  const { id, roleId } = request.auth.credentials;
  const result = {};

  const promise = Order.findOne({ where: { id: orderId } })
    .then(order => {
      if (!order) {
        throw Boom.notFound(`La commande demandée n'existe pas. Id: ${orderId}`);
      }

      if (order.userId !== id && roleId !== UserRole.ROLE_CHEF && roleId !== UserRole.ROLE_ADMIN) {
        throw Boom.forbidden(`Vous n'êtes pas autorisé à accéder à cette commande.`);
      }

      if (order.statusId === OrderStatus.FINISHED || order.statusId === OrderStatus.CANCELED) {
        throw Boom.preconditionFailed(
          `Cette commande est déjà terminée, elle ne peut pas être consultée.`
        );
      }

      if (order.deliveryTypeId !== DeliveryType.EXPRESS) {
        throw Boom.preconditionFailed(
          `Cette information n'est pas disponible pour ce type de commande.`
        );
      }

      if (order.statusId === OrderStatus.DELIVERY) {
        result.orderDate = order.date;
      }

      return OrderStatus.findOne({ where: { id: order.statusId } });
    })
    .then(statusDb => {
      const status = statusDb.toJSON();
      result.status = status;

      return result;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });
  reply(promise);
}

function calculateDeliveryCost(db, deliveryType, address) {
  const { DeliveryZone, DeliveryType } = db.getModels();

  const total = {
    vatExcl: 0,
    vatIncl: 0,
  };

  const promise = DeliveryZone.findAll()
    .then(zones => {
      const zone = getZoneFromAddress(address.lat, address.lng, zones);

      if (zone === null) {
        throw Boom.notFound(`L'adresse fournie n'appartient pas à une zone de livraison valide.`);
      }

      total.vatExcl += zone.additionalCost;
      total.vatIncl += zone.additionalCostTax;

      return DeliveryType.findOne({ where: { id: deliveryType } });
    })
    .then(dType => {
      if (!dType) {
        throw Boom.notFound(`Le type de livraison spécifié n'existe pas.`);
      }

      total.vatExcl += dType.get('additionalCost');
      total.vatIncl += dType.get('additionalCostTax');

      return total;
    });

  return promise;
}

function isNextStatusValid(current, next, OrderStatus) {
  const map = {};

  map[OrderStatus.PENDING] = [OrderStatus.PROCESSING, OrderStatus.CANCELED];
  map[OrderStatus.PROCESSING] = [OrderStatus.PACKING, OrderStatus.DELIVERY, OrderStatus.FINISHED];
  map[OrderStatus.PACKING] = [OrderStatus.DELIVERY, OrderStatus.FINISHED];
  map[OrderStatus.DELIVERY] = [OrderStatus.FINISHED];

  if (Object.prototype.hasOwnProperty.call(map, current)) {
    return map[current].indexOf(next) !== -1;
  }

  return false;
}

function createInvoice(order, request) {
  const templatePath = resolve(__dirname, 'templates', 'invoice.html');
  const logo = resolve(config.get('/publicImgFolder'), 'logo.png');
  const numFact = `FA${order.id}.pdf`;
  order.items.map(item => {
    item.unitPrice = item.totalTax / item.quantity;
    return item;
  });

  const promise = templater
    .getCompiledHtml(templatePath, {
      customerFirstname: order.user.firstname,
      customerLastname: order.user.lastname,
      customerAddress: `${order.deliveryAddress.address1} ${order.deliveryAddress.zipcode} ${order
        .deliveryAddress.city}`,
      customerEmail: order.user.email,
      purchaseDate: moment().format('DD/MM/YYYY HH:mm'),
      items: order.items,
      totalHT: order.total,
      totalTVA: order.totalTax - order.total,
      totalTTC: order.totalTax,
      totalDelivery: order.deliveryCostTax,
      totalDiscount: order.discountTax,
      logo: `file://${logo}`,
    })
    .then(compiledHtml => {
      const configPDF = { format: 'A4' };
      return htmlToPDF(compiledHtml, configPDF, `public/invoices/${order.userId}/${numFact}`);
    })
    .catch(err => {
      request.log(['error'], `Erreur lors de la création de la facture : ${numFact}.<br> ${err}`);
    });

  return promise;
}

function getPromoCodeDiscountAmount(code, total, totalTax) {
  if (code.amountPercentage) {
    return {
      discount: (total * code.amountPercentage / 100).toFixed(2),
      discountTax: (totalTax * code.amountPercentage / 100).toFixed(2),
    };
  }

  return {
    discount: code.amount,
    discountTax: code.amountTax,
  };
}
