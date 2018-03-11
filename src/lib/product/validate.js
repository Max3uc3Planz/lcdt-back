'use strict';

const Joi = require('joi');

const productStock = Joi.object().keys({
  id: Joi.number().integer().min(1).required(),
  stocks: Joi.array()
    .items(
      Joi.object()
        .keys({
          id: Joi.number().integer().min(1),
          stock: Joi.number().integer().positive().required(),
          active: Joi.boolean().required(),
          date: Joi.date()
            .min(new Date(new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000))
            .max(new Date(new Date().setHours(23, 59, 59, 999) + 7 * 24 * 60 * 60 * 1000))
            .required(),
        })
        .options({ stripUnknown: true })
    )
    .min(1)
    .required(),
});

const oneProductStock = Joi.object()
  .keys({
    id: Joi.number().integer().min(1),
    stock: Joi.number().integer().positive().required(),
    active: Joi.boolean().required(),
    date: Joi.date()
      .min(new Date(new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000))
      .max(new Date(new Date().setHours(23, 59, 59, 999) + 7 * 24 * 60 * 60 * 1000))
      .required(),
  })
  .options({ stripUnknown: true });

exports.newProduct = Joi.object()
  .keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    shortDescription: Joi.string().required(),
    price: Joi.number().positive().required(),
    priceTax: Joi.number().positive().required(),
    ingredients: Joi.string().empty(null, ''),
    preparation: Joi.string().empty(null, ''),
    personsNb: Joi.number().integer(),
    categoryId: Joi.number().min(0),
    tags: Joi.array().items(Joi.object().keys({ id: Joi.number().integer().min(1).required() })),
    options: Joi.array().items(Joi.number().integer().min(1)),
  })
  .options({ stripUnknown: true });

exports.product = Joi.object()
  .keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    shortDescription: Joi.string().required(),
    price: Joi.number().positive().required(),
    priceTax: Joi.number().positive().required(),
    ingredients: Joi.string().empty(null, ''),
    preparation: Joi.string().empty(null, ''),
    personsNb: Joi.number().integer(),
    categoryId: Joi.number().min(0).empty(null),
    tags: Joi.array().items(Joi.object().keys({ id: Joi.number().integer().min(1).required() })),
    options: Joi.array().items(Joi.number().integer().min(1)),
  })
  .options({ stripUnknown: true });

exports.productsQuery = Joi.object()
  .keys({
    page: Joi.number().min(1).required(),
    category: Joi.number().min(1),
    name: Joi.string().empty(''),
  })
  .options({ stripUnknown: true });

exports.productsStocks = Joi.array().items(productStock);
exports.productStocks = Joi.array().items(oneProductStock).min(1).required();
