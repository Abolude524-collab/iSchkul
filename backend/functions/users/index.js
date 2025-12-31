/**
 * User Registration & Profile Management
 * Azure Function for user registration with complete profile data
 */

const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
  context.log("User registration triggered");

  if (req.method === "POST" && req.url.includes("/register")) {
    return await handleRegister(context, req);
  } else if (req.method === "POST" && req.url.includes("/forgot-password")) {
    return await handleForgotPassword(context, req);
  } else if (req.method === "POST" && req.url.includes("/reset-password")) {
    return await handleResetPassword(context, req);
  } else if (req.method === "PUT" && req.url.includes("/profile")) {
    return await handleUpdateProfile(context, req);
  } else if (req.method === "GET" && req.url.includes("/profile")) {
    return await handleGetProfile(context, req);
  } else if (req.method === "POST" && req.url.includes("/avatar")) {
    return await handleUploadAvatar(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Register new user
 */
async function handleRegister(context, req) {
  const {
    name,
    firstName,
    lastName,
    username,
    email,
    password,
    securityQuestion,
    securityAnswer,
    phonenumber,
    studentcategory,
    institution,
  } = req.body;

  // Validation
  if (!name || !email || !password) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "name, email, and password required" }),
    };
    return;
  }

  if (password.length < 6) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Password must be at least 6 characters" }),
    };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    // Check if user exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      context.res = {
        status: 409,
        body: JSON.stringify({ error: "User with this email already exists" }),
      };
      await client.close();
      return;
    }

    // Check username uniqueness
    if (username) {
      const existingUsername = await usersCollection.findOne({ username });
      if (existingUsername) {
        context.res = {
          status: 409,
          body: JSON.stringify({ error: "Username already taken" }),
        };
        await client.close();
        return;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    let hashedSecurityAnswer = null;
    if (securityAnswer) {
      hashedSecurityAnswer = await bcrypt.hash(securityAnswer.toLowerCase(), 10);
    }

    // Create user object
    const newUser = {
      name,
      firstName: firstName || null,
      lastName: lastName || null,
      username: username || null,
      email: email.toLowerCase(),
      password: hashedPassword,
      securityQuestion: securityQuestion || null,
      securityAnswer: hashedSecurityAnswer,
      profilePicture: null,
      avatar: null,
      phonenumber: phonenumber || null,
      studentcategory: studentcategory || "",
      institution: institution || null,
      total_xp: 0,
      last_active_date: null,
      current_streak: 0,
      is_leaderboard_visible: false,
      is_admin: false,
      role: "student",
      isSuperAdmin: false,
      badges: [],
      sotw_win_count: 0,
      course: "",
      profileCompleted: false,
      isOnline: false,
      lastSeen: new Date(),
      totalScore: 0,
      testsTaken: 0,
      contacts: [],
      following: [],
      followers: [],
      settings: {
        theme: "system",
        fontSize: "medium",
        language: "en",
        timeFormat: "12h",
        mediaAutoplay: true,
        readReceipts: true,
        typingIndicators: true,
        soundEnabled: true,
        vibrationEnabled: true,
        autoDownloadMedia: "wifi",
        showPreviewText: true,
        pushNotifications: true,
        notificationTone: "default",
        lastSeen: "everyone",
        profilePhotoVisibility: "everyone",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    // Generate JWT
    const token = jwt.sign(
      { userId: result.insertedId.toString(), email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Log activity
    const activitiesCollection = db.collection("activities");
    await activitiesCollection.insertOne({
      userId: result.insertedId,
      type: "user.registered",
      meta: { email: newUser.email },
      createdAt: new Date(),
    });

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: result.insertedId.toString(),
          name: newUser.name,
          email: newUser.email,
          username: newUser.username,
          profileCompleted: false,
        },
        message: "Registration successful. Please complete your profile.",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Registration failed" }),
    };
  }
}

/**
 * Forgot Password - Get Security Question
 */
async function handleForgotPassword(context, req) {
  const { email } = req.body;

  if (!email) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Email required" }),
    };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
      await client.close();
      return;
    }

    if (!user.securityQuestion) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "No security question set for this account" }),
      };
      await client.close();
      return;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        securityQuestion: user.securityQuestion,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to process request" }),
    };
  }
}

/**
 * Reset Password using Security Answer
 */
async function handleResetPassword(context, req) {
  const { email, securityAnswer, newPassword } = req.body;

  if (!email || !securityAnswer || !newPassword) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Email, security answer, and new password required" }),
    };
    return;
  }

  if (newPassword.length < 6) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Password must be at least 6 characters" }),
    };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
      await client.close();
      return;
    }

    // Verify security answer
    const isAnswerMatch = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswer);
    if (!isAnswerMatch) {
      context.res = {
        status: 401,
        body: JSON.stringify({ error: "Incorrect security answer" }),
      };
      await client.close();
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        message: "Password reset successfully",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to reset password" }),
    };
  }
}

/**
 * Update user profile
 */
async function handleUpdateProfile(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const updates = req.body;
    delete updates.password; // Prevent password update via profile
    delete updates.email; // Prevent email update via profile
    delete updates._id;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    // Check if profile is being completed
    const profileFields = [
      "firstName",
      "lastName",
      "institution",
      "studentcategory",
      "phonenumber",
    ];
    const hasProfileData = profileFields.some((field) => updates[field]);

    if (hasProfileData) {
      updates.profileCompleted = true;
    }

    updates.updatedAt = new Date();

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result.value) {
      context.res = { status: 404, body: JSON.stringify({ error: "User not found" }) };
      await client.close();
      return;
    }

    // Remove sensitive data
    delete result.value.password;
    delete result.value.securityAnswer;

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        user: result.value,
        message: "Profile updated successfully",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Profile update failed" }),
    };
  }
}

/**
 * Get user profile
 */
async function handleGetProfile(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  const targetUserId = req.query.userId; // Optional: get another user's profile

  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = targetUserId || decoded.userId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      context.res = { status: 404, body: JSON.stringify({ error: "User not found" }) };
      await client.close();
      return;
    }

    // Remove sensitive data
    delete user.password;
    delete user.securityAnswer;

    // If viewing another user's profile, respect privacy settings
    if (targetUserId && targetUserId !== decoded.userId) {
      if (user.settings?.profilePhotoVisibility === "nobody") {
        delete user.profilePicture;
        delete user.avatar;
      }
      if (user.settings?.lastSeen === "nobody") {
        delete user.lastSeen;
        delete user.isOnline;
      }
    }

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, user }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get profile" }),
    };
  }
}

/**
 * Upload avatar/profile picture
 */
async function handleUploadAvatar(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const file = req.files?.avatar || req.files?.profilePicture;

    if (!file) {
      context.res = { status: 400, body: JSON.stringify({ error: "No file uploaded" }) };
      return;
    }

    // Upload to Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.BLOB_STORAGE_CONN
    );
    const containerClient = blobServiceClient.getContainerClient("avatars");

    const blobName = `${userId}-${Date.now()}.${file.originalname.split(".").pop()}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.data, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    const avatarUrl = blockBlobClient.url;

    // Update user
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { profilePicture: avatarUrl, avatar: avatarUrl, updatedAt: new Date() } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        avatarUrl,
        message: "Avatar uploaded successfully",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Avatar upload failed" }),
    };
  }
}
