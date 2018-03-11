'use strict';

const Boom = require('boom');

exports.getUserInvoice = getUserInvoice;

function getUserInvoice(request, reply) {
  const { userId, invoiceId } = request.params;
  const db = request.getDb();
  const { id, roleId } = request.auth.credentials;
  const { Order, UserRole } = db.getModels();

  // We check if the user asking for the addresses is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  Order.findOne({ where: { id: invoiceId, userId } })
    .then(order => {
      if (order === null) {
        throw Boom.notFound(`La commande n'existe pas`);
      }

      reply.file(order.invoiceUrl, { filename: `cantine_facture_${order.id}` });
    })
    .catch(err => {
      reply(Boom.boomify(err));
    });

  return null;
}
