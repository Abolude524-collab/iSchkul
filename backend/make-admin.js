/**
 * Make User Admin Script
 * Run this to promote a user to admin role
 */

const { MongoClient, ObjectId } = require("mongodb");

async function makeUserAdmin(email) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);

  try {
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    const result = await db.collection("users").updateOne(
      { email: email },
      {
        $set: {
          is_admin: true,
          role: "admin",
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ User ${email} has been promoted to admin!`);
    } else {
      console.log(`❌ User ${email} not found or already admin.`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

// Usage: node make-admin.js user@example.com
const email = process.argv[2];
if (!email) {
  console.log("Usage: node make-admin.js <email>");
  process.exit(1);
}

makeUserAdmin(email);