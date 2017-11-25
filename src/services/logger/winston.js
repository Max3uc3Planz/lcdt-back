
const winston = require('winston');

const { createLogger, format, transports } = winston;
const { combine, timestamp, label, printf } = format;

let loggerInstance = null;


const myFormat = printf(info => {
    if(info.site !== undefined) {
        return `${info.timestamp} [${info.label.entrypoint}][${info.label.module}][${info.site}] ${info.level}: ${info.message}`;
    }
    return `${info.timestamp} [${info.label.entrypoint}][${info.label.module}] ${info.level}: ${info.message}`;
});

const configLogger = (entrypoint, module) => {
    let transport = [];
    transport.push(new transports.Console());

    return {
        format: combine(
            label({label: { entrypoint: entrypoint,  module: module }}),
            timestamp(),
            myFormat,
        ),
        transports: transport
    };
};

const boostrap = (entrypoint) => {
    [
        'auth-controller'
    ].forEach((elem) => winston.loggers.add(elem, configLogger(entrypoint, elem)));
};



module.exports = {
    init : (entrypoint) => {
        if (loggerInstance === null) {
            boostrap(entrypoint);
            loggerInstance = true;
        }
    },
    get: (elem) => winston.loggers.get(elem)
};
