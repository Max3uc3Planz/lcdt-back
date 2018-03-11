'use strict';

module.exports = (sequelize, DataTypes) => {
  const Telephone = sequelize.define(
    'Telephone',
    {
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [0, 20],
        },
      },
      isMain: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      tableName: 'Telephone',
      classMethods: {
        associate(db) {
          this.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
        },
      },
    }
  );

  return Telephone;
};
