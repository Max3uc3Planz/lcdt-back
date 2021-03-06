require("./services/config/config");
const express = require('express');

const logger = require('./services/logger/winston');

//INIT LOGGER
logger.init('server');

const app = express();
const authRoute = require('./route/auth.route');

app.use('/auth', authRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT);
console.log('apps ruuning on port ' + PORT);





