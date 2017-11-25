
const logger = require("../services/logger/winston").get('auth-controller');

async function testFunction(req, res) {

    logger.info("je suis dans test.");
    const test = String(req.params.test);
    res.send({ data: test });
}


module.exports = { testFunction };