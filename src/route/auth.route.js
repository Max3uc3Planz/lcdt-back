const express = require('express');
const router = express.Router();

const authController = require('../controller/auth.controller');

console.log("je suis dans la route.");

router.get('/:test', authController.testFunction);

module.exports = router;
