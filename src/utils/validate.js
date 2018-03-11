'use strict';

const Joi = require('joi');

exports.id = Joi.number().min(1).required();
exports.fileName = Joi.string().required();
