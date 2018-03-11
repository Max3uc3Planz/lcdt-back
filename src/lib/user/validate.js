'use strict';

const Joi = require('joi');
const { phoneOnly } = require('./telephone/validate');

exports.login = Joi.object()
  .keys({
    email: Joi.string().email().max(120),
    username: Joi.string().max(100),
    password: Joi.string().required().min(8).max(255),
  })
  .xor('email', 'username');

exports.recoverPwd = Joi.object().keys({
  email: Joi.string().email().required(),
  frontendUrl: Joi.string().uri().required(),
});

exports.signupUser = Joi.object().keys({
  email: Joi.string().email().max(120).required(),
  password: Joi.string()
    .regex(
      /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
      'Minimum 8 caractères dont 1 majuscule et 1 chiffre'
    )
    .required(),
  lastname: Joi.string().required(),
  firstname: Joi.string().required(),
  phone: phoneOnly,
  sponsorCode: Joi.string().min(18).max(20),
});

exports.createUserPwd = Joi.object()
  .keys({
    password: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      )
      .required(),
    passwordRepeat: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      )
      .required(),
    token: Joi.string().hex().required(),
  })
  .options({ stripUnknown: true });

exports.ban = Joi.object()
  .keys({
    explanation: Joi.string(),
    duration: Joi.number().min(-1).required(),
  })
  .options({ stripUnknown: true });

exports.updateUser = Joi.object()
  .keys({
    id: Joi.number().min(1).required(),
    email: Joi.string().email().max(120).required(),
    firstname: Joi.string().required(),
    lastname: Joi.string().required(),
    oldPassword: Joi.string(),
    newPassword: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      ),
    newPasswordRepeat: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      ),
  })
  .and('oldPassword', 'newPassword', 'newPasswordRepeat')
  .options({ stripUnknown: true });

exports.updateUserAsAdmin = Joi.object()
  .keys({
    id: Joi.number().min(1).required(),
    email: Joi.string().email().max(120).required(),
    firstname: Joi.string().required(),
    lastname: Joi.string().required(),
    username: Joi.string(),
    newPassword: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      ),
    newPasswordRepeat: Joi.string()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[0-9]).{8,}$/,
        'Mot de passe 8 caractères, 1 majuscule et 1 chiffre'
      ),
  })
  .and('newPassword', 'newPasswordRepeat')
  .options({ stripUnknown: true });

exports.filename = Joi.string().required();
exports.validateAction = Joi.string()
  .regex(/^(validate|refuse)$/, 'Action pour validation')
  .required();
exports.date = Joi.date().iso();
