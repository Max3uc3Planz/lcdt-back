'use strict';

const config = require('~/config');
const jwt = require('jsonwebtoken');
const { isBanned } = require('~/utils/user');

const internals = {};

exports.register = function register(server, options, next) {
  // Define the 'jwt' strategy for authentication on the server.
  server.auth.strategy('jwt', 'jwt', {
    key: config.get('/security/jwt/key'),
    validateFunc: validate,
    verifyOptions: { algorithms: [config.get('/security/jwt/algorithm')] },
  });

  // Set the 'jwt' authentication strategy as the default to apply
  // if no config is specified for a route.
  server.auth.default('jwt');
  server.ext(internals.generateTokenExtension);

  next();
};

exports.register.attributes = {
  name: 'CantineAuthJwtPlugin',
  version: '1.0.0',
};

exports.validateFn = validate;

internals.cookieOptions = config.get('/security/jwt/cookieOptions');

internals.generateTokenExtension = {
  type: 'onPostHandler',
  method: function createToken(request, response) {
    if (request.path === '/login' || request.path === '/register') {
      // If an error happened during the login / registration, the token is not added.
      if (request.response.isBoom) {
        return response.continue();
      }

      const user = request.response.source;
      let userObj;

      if (typeof user === 'object') {
        userObj = Object.assign({}, user);
      } else {
        userObj = JSON.parse(user);
      }

      const issuedAt = new Date().getTime();
      const tokenClaims = {
        id: userObj.id,
        roleId: userObj.role.id,
        exp: issuedAt + internals.cookieOptions.ttl,
        iat: issuedAt,
      };

      const token = jwt.sign(tokenClaims, config.get('/security/jwt/key'), {
        algorithm: config.get('/security/jwt/algorithm'),
        //TODO: see if other options are needed
      });

      userObj.token = token;
      return response(userObj)
        .header('Authorization', token)
        .state('token', token, internals.cookieOptions);
    }

    return response.continue();
  },
};

function validate(decoded, request, callback) {
  // TODO: should implement scopes verification, could implement jti fields verifications
  const currentTime = new Date().getTime();
  const db = request.getDb();
  const { BlacklistToken, User, UserBan } = db.getModels();
  const { exp, id } = decoded;
  const requestToken = request.auth.token;

  if (currentTime > exp) {
    return process.nextTick(() => callback(null, false));
  }

  // remove expired token from db
  BlacklistToken.destroy({
    where: {
      expire: {
        $lt: `${exp}`,
      },
    },
  })
    // check if token is not blacklisted
    // FIXME: would be better to identify token on JTI
    .then(() => BlacklistToken.findOne({ where: { token: requestToken } }))
    .then(token => {
      if (token) {
        throw new Error('Token blacklisté');
      }

      return User.findOne({ where: { id }, include: [{ model: UserBan, as: 'bans' }] })
        .then(user => {
          if (user.deleted || isBanned(user)) {
            return BlacklistToken.create({ expire: exp, token: requestToken });
          }

          return null;
        })
        .then(blToken => {
          if (blToken) {
            throw new Error('Utilisateur banni donc token blacklisté');
          }

          return null;
        })
        .then(() => process.nextTick(() => callback(null, true)));
    })
    .catch(() => process.nextTick(() => callback(null, false)));
}
