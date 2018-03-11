'use strict';

const moment = require('moment');

const {
  checkProductIsAvailable,
  checkAddressInZones,
  checkTimeSlotAvailability,
} = require('./functions');

module.exports = {
  checkProductAvailability,
  checkIsAddressInZones,
  checkTimeSlot,
  checkTimeSlotTest,
};

function checkProductAvailability(request, reply) {
  const db = request.getDb();
  const productId = request.params.id;
  const qty = request.params.qty;

  reply(checkProductIsAvailable(db, productId, qty));
}

function checkIsAddressInZones(request, reply) {
  const db = request.getDb();
  const { latitude, longitude } = request.query;

  return reply(checkAddressInZones(db, latitude, longitude));
}

function checkTimeSlot(request, reply) {
  const db = request.getDb();
  const now = moment().tz('Europe/Paris');

  reply(checkTimeSlotAvailability(db, now, request.payload));
}

function checkTimeSlotTest(request, reply) {
  const db = request.getDb();
  const now = moment(request.params.date).tz('Europe/Paris');

  reply(checkTimeSlotAvailability(db, now, request.payload));
}
