'use strict';

const Joi = require('joi');

const latitude = Joi.number().min(-90).max(90).required();
const longitude = Joi.number().min(-180).max(180).required();
const test = Joi.date().required();


exports.timeslot = Joi.object().keys({
  weekDay: Joi.number().min(0).max(6),
  deliveryType: Joi.number().min(0).required(),
  timeMin: Joi.number().min(0).max(2359).required(),
  timeMax: Joi.number().min(0).max(2359).required(),
}).options({ stripUnknown: true });

exports.latitude = latitude;
exports.longitude = longitude;
exports.test = test;

