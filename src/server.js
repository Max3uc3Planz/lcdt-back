const express = require('express');

const app = express();
const authRoute = require('./route/auth.route');

app.use('/auth', authRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT);
console.log('apps ruuning on port ' + PORT);





