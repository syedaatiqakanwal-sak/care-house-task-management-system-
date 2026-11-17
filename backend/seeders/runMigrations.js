const { sequelize } = require("../models");

async function run() {
  await sequelize.sync({ alter: true });
  // eslint-disable-next-line no-console
  console.log("Database synchronized");
  process.exit(0);
}
run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
