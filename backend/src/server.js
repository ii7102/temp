const app = require('./app');
const db = require('./db');
const { port } = require('./config');

async function start() {
  await db.initializeSchema();

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
