const express = require('express');
const router = express.Router();


const authController = require('../controller/auth.controller');


router.get('/:test', authController.testFunction);

module.exports = router;
