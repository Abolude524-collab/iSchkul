/**
 * Database Connection Manager
 * Handles Cosmos DB (MongoDB) and logging
 */

const { MongoClient } = require("mongodb");

let cachedClient = null;

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();

  cachedClient = client;
  return client;
}

async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.COSMOS_DB_NAME);
}

module.exports = {
  getMongoClient,
  getDatabase,
  closeClient: async () => {
    if (cachedClient) {
      await cachedClient.close();
      cachedClient = null;
    }
  },
};
