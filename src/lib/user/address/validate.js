'use strict';

const Joi = require('joi');

exports.newAddress = Joi.object().keys({
  label: Joi.string().max(50).required(),
  address1: Joi.string().max(100).required(),
  city: Joi.string().max(50).required(),
  zipcode: Joi.string().max(10).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  placeId: Joi.string().required(),
});

exports.address = Joi.object().keys({
  id: Joi.number().min(1).required(),
  label: Joi.string().max(50).required(),
  address1: Joi.string().max(100).required(),
  city: Joi.string().max(50).required(),
  zipcode: Joi.string().max(10).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  placeId: Joi.string().required(),
}).options({ stripUnknown: true });

exports.validateAddress = Joi.object().keys({
  streetNumber: Joi.string().required(),
  route: Joi.string().required(),
  city: Joi.string().required(),
  zipCode: Joi.string().required(),
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  placeId: Joi.string().required(),
}).options({ stripUnknown: true });
