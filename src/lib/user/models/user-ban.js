'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserBan = sequelize.define(
    'UserBan',
    {
      explanation: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      // will be in minutes or -1 for infinite ban
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'UserBan',
      classMethods: {
        associate(db) {
          this.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
        },
      },
    }
  );

  return UserBan;
};
