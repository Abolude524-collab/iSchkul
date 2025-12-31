const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

module.exports = async function (context, req) {
  context.log("Auth/Login triggered");

  if (req.method !== "POST") {
    context.res = { status: 405, body: "Method not allowed" };
    return;
  }

  const { email, password } = req.body;

  if (!email || !password) {
    context.res = { status: 400, body: JSON.stringify({ error: "Email/Username and password required" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();

    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    // Find user
    const user = await usersCollection.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email }
      ]
    });
    if (!user) {
      context.res = { status: 401, body: JSON.stringify({ error: "Invalid credentials" }) };
      await client.close();
      return;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      context.res = { status: 401, body: JSON.stringify({ error: "Invalid credentials" }) };
      await client.close();
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: user.is_admin || user.isSuperAdmin || user.role === "admin",
          role: user.role || (user.isSuperAdmin ? "superadmin" : user.is_admin ? "admin" : "user"),
        },
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};
