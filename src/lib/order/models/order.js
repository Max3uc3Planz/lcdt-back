'use strict';

module.exports = (sequelize, { DATE, STRING, FLOAT }) => {
  const Order = sequelize.define(
    'Order',
    {
      date: {
        type: DATE,
        allowNull: false,
      },
      total: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      totalTax: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      discount: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      discountTax: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      paymentMethod: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      tslotMin: {
        type: DATE,
        allowNull: false,
      },
      tslotMax: {
        type: DATE,
        allowNull: false,
      },
      deliveryCost: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      deliveryCostTax: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      invoiceUrl: {
        type: STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'Order',
      classMethods: {
        associate({
          DeliveryType,
          Address,
          User,
          Telephone,
          OrderItem,
          OrderStatus,
          PromotionalCode,
          SponsorshipDiscount,
        }) {
          this.belongsTo(DeliveryType, { as: 'deliveryType', foreignKey: 'deliveryTypeId' });
          this.belongsTo(Address, { as: 'deliveryAddress', foreignKey: 'addressId' });
          this.belongsTo(User, { as: 'user', foreignKey: 'userId' });
          this.belongsTo(Telephone, { as: 'telephone', foreignKey: 'telephoneId' });
          this.belongsTo(OrderStatus, { as: 'status', foreignKey: 'statusId' });
          this.belongsTo(PromotionalCode, {
            as: 'promotionalCode',
            foreignKey: 'promotionalCodeId',
          });
          this.belongsTo(SponsorshipDiscount, {
            as: 'sponsorshipCode',
            foreignKey: 'sponsorshipCodeId',
          });

          this.hasMany(OrderItem, { as: 'items', foreignKey: 'orderId', onDelete: 'cascade' });
        },
      },
    }
  );

  return Order;
};
