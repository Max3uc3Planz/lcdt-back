
async function testFunction(req, res) {

    console.log("je suis dans test.");
    const test = String(req.params.test);
    res.send({ data: test });
}


module.exports = { testFunction };