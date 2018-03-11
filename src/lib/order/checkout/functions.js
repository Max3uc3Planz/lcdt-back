'use strict';

const Boom = require('boom');
const moment = require('moment');
const { getDateBoundaries } = require('~/utils/date');
const { isAddressInZones } = require('~/utils/address');
const dateUtil = require('~/utils/date');

module.exports = {
  checkProductIsAvailable,
  checkAddressInZones,
  checkTimeSlotAvailability,
  isSponsorshipCodeValid,
};

function checkProductIsAvailable(db, productId, qty) {
  const { Product, DayStock } = db.getModels();
  const { minDate, maxDate } = getDateBoundaries();
  const sequelize = db.sequelize;
  let p;

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Product.findOne({
        where: {
          id: productId,
        },
        transaction,
      })
        .then(product => {
          if (!product) {
            throw Boom.notFound(`Le produit demandé n'existe pas ! (id : ${productId})`);
          }
          p = product;
          return Product.findOne({
            attributes: { exclude: ['price'] },
            where: {
              id: productId,
              currentStock: {
                $and: {
                  $gt: 0,
                  $gte: qty,
                },
              },
            },
            include: [
              {
                model: DayStock,
                as: 'stocks',
                where: {
                  date: {
                    $between: [minDate, maxDate],
                  },
                  active: true,
                },
              },
            ],
            transaction,
          });
        })
        .then(productAvailable => {
          if (productAvailable === null) {
            throw Boom.notFound(`Le produit ${p.title} n'est plus disponible !`);
          }

          return {
            result: 'success',
            message: 'Le produit est disponible',
            product: p,
            qty,
          };
        });

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return promise;
}

function checkAddressInZones(db, latitude, longitude) {
  const sequelize = db.sequelize;
  const { DeliveryZone } = db.getModels();

  const promise = sequelize
    .transaction(transaction => {
      const insidePromise = DeliveryZone.findAll({ transaction }).then(deliveryZones => {
        if (!isAddressInZones(latitude, longitude, deliveryZones)) {
          throw Boom.badData(`Votre adresse n'est pas encore desservie !`);
        }
        return {
          result: 'success',
          message: `L'adresse de livraison est bien desservie`,
        };
      });

      return insidePromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return promise;
}

function checkTimeSlotAvailability(db, now, timeSlot) {
  const { TimeSlot, DeliveryType } = db.getModels();

  const nowEarly = moment(now).add(1, 'h');
  const tomorrow = moment(now).add(1, 'd');
  const time = dateUtil.extractTime(now);
  const timeEarly = dateUtil.extractTime(nowEarly);

  if (timeSlot.weekDay === undefined) {
    timeSlot.weekDay = now.day();
  }

  const promise = TimeSlot.findAll({
    where: {
      $or: [
        {
          $or: [
            {
              weekDay: now.day(),
              timeMin: { $lte: time },
              timeMax: { $gte: time },
              deliveryTypeId: DeliveryType.EXPRESS,
            },
            {
              weekDay: nowEarly.day(),
              timeMax: { $gte: timeEarly },
              deliveryTypeId: DeliveryType.EARLY,
            },
          ],
        },
        {
          weekDay: tomorrow.day(),
          deliveryTypeId: DeliveryType.EARLY,
        },
      ],
    },
    include: [{ model: DeliveryType, as: 'deliveryType' }],
  })
    .then(timeslots => {
      const match = timeslots.find(timeslotModel => {
        const ts = timeslotModel.toJSON();

        if (timeSlot.deliveryType === DeliveryType.EXPRESS) {
          return ts.weekDay === timeSlot.weekDay && ts.deliveryType.id === timeSlot.deliveryType;
        }

        return (
          ts.weekDay === timeSlot.weekDay &&
          ts.timeMin <= timeSlot.timeMin &&
          ts.timeMax >= timeSlot.timeMax &&
          ts.deliveryType.id === timeSlot.deliveryType
        );
      });

      if (!match) {
        throw Boom.badData(`Le créneau sélectionné n'est plus disponible`);
      }

      if (timeSlot.deliveryType === DeliveryType.EARLY) {
        if (timeSlot.timeMin < timeEarly) {
          throw Boom.badData(`Le créneau sélectionné n'est plus disponible`);
        }

        const availableSlots = [];

        // We build an array containing all the valid intervals.
        for (let hour = Math.floor(match.timeMin / 100); hour <= match.timeMax; hour += 1) {
          const sTime = hour * 100;
          availableSlots.push(sTime);
          availableSlots.push(sTime + 30);
        }

        // We remove the first slot if it does not belong between the interval.
        if (availableSlots[0] < match.timeMin) {
          availableSlots.splice(0, 1);
        }

        // We remove the last slot if it does not belong between the interval.
        if (availableSlots[availableSlots.length - 1] > match.timeMax) {
          availableSlots.pop();
        }

        if (
          timeSlot.timeMax - timeSlot.timeMin !== 100 ||
          availableSlots.indexOf(timeSlot.timeMin) === -1
        ) {
          throw Boom.badData(`Le créneau sélectionné est invalide`);
        }
      }

      return {
        result: 'success',
        message: `Créneau correct`,
      };
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return promise;
}

function isSponsorshipCodeValid(db, code, userId) {
  const { SponsorshipDiscount } = db.getModels();

  return SponsorshipDiscount.findOne({ where: { code, userId, consumed: false } })
    .then(codeDb => {
      if (!codeDb) {
        throw Boom.notFound(`Le code de parrainage n'existe pas. Code : ${code}.`);
      }

      return codeDb.toJSON();
    })
    .catch(err => {
      throw Boom.boomify(err);
    });
}
