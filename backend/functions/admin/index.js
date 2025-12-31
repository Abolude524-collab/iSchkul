/**
 * Admin Panel Backend
 * User management, content moderation, system administration
 */

const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Admin endpoint triggered");

  const action = req.params.action;

  // Verify admin authorization
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Check if user is admin
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!user || (!user.is_admin && !user.isSuperAdmin && user.role !== "admin")) {
      context.res = {
        status: 403,
        body: JSON.stringify({ error: "Admin access required" }),
      };
      await client.close();
      return;
    }

    // Route to appropriate handler
    if (req.method === "GET" && action === "users") {
      await listUsers(context, req, db);
    } else if (req.method === "PUT" && action === "users/role") {
      await updateUserRole(context, req, db, user);
    } else if (req.method === "DELETE" && action === "users") {
      await deleteUser(context, req, db, user);
    } else if (req.method === "GET" && action === "content") {
      await listContent(context, req, db);
    } else if (req.method === "DELETE" && action === "content") {
      await deleteContent(context, req, db);
    } else if (req.method === "GET" && action === "reports") {
      await getReports(context, req, db);
    } else if (req.method === "POST" && action === "notifications/send") {
      await sendNotification(context, req, db, user);
    } else if (req.method === "GET" && action === "system") {
      await getSystemHealth(context, req, db);
    } else {
      context.res = {
        status: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Admin operation failed" }),
    };
  }
};

/**
 * List users with filters
 */
async function listUsers(context, req, db) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  const search = req.query.search;
  const role = req.query.role;
  const category = req.query.category;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
    ];
  }
  if (role) {
    query.role = role;
  }
  if (category) {
    query.studentcategory = category;
  }

  const users = await db
    .collection("users")
    .find(query, {
      projection: {
        password: 0,
        securityAnswer: 0,
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection("users").countDocuments(query);

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }),
  };
}

/**
 * Update user role
 */
async function updateUserRole(context, req, db, adminUser) {
  const { userId, role, isAdmin } = req.body;

  if (!userId || (!role && isAdmin === undefined)) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "userId and (role or isAdmin) required" }),
    };
    return;
  }

  // Only superadmin can modify admin roles
  if ((role === "admin" || isAdmin === true) && !adminUser.isSuperAdmin) {
    context.res = {
      status: 403,
      body: JSON.stringify({ error: "SuperAdmin access required to modify admin roles" }),
    };
    return;
  }

  const updateFields = {};
  if (role) updateFields.role = role;
  if (isAdmin !== undefined) updateFields.is_admin = isAdmin;

  await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: updateFields });

  // Log activity
  await db.collection("activities").insertOne({
    userId: new ObjectId(adminUser._id),
    type: "admin.role_updated",
    meta: { targetUserId: userId, updates: updateFields },
    visibility: "admin",
    createdAt: new Date(),
  });

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      message: "User role updated successfully",
    }),
  };
}

/**
 * Delete user
 */
async function deleteUser(context, req, db, adminUser) {
  const userId = req.query.userId;

  if (!userId) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "userId required" }),
    };
    return;
  }

  // Cannot delete superadmin
  const targetUser = await db.collection("users").findOne({ _id: new ObjectId(userId) });
  if (targetUser && targetUser.isSuperAdmin) {
    context.res = {
      status: 403,
      body: JSON.stringify({ error: "Cannot delete superadmin" }),
    };
    return;
  }

  // Delete user and related data
  await db.collection("users").deleteOne({ _id: new ObjectId(userId) });
  await db.collection("quizResults").deleteMany({ userId: new ObjectId(userId) });
  await db.collection("flashcards").deleteMany({ userId: new ObjectId(userId) });
  await db.collection("flashcard_reviews").deleteMany({ userId: new ObjectId(userId) });
  await db.collection("messages").deleteMany({ fromUserId: new ObjectId(userId) });
  await db.collection("activities").deleteMany({ userId: new ObjectId(userId) });
  await db.collection("notifications").deleteMany({ userId: new ObjectId(userId) });

  // Log activity
  await db.collection("activities").insertOne({
    userId: new ObjectId(adminUser._id),
    type: "admin.user_deleted",
    meta: { targetUserId: userId },
    visibility: "admin",
    createdAt: new Date(),
  });

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      message: "User deleted successfully",
    }),
  };
}

/**
 * List content for moderation
 */
async function listContent(context, req, db) {
  const type = req.query.type; // 'quiz', 'flashcard', 'message'
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  let collection;
  let projection = {};

  if (type === "quiz") {
    collection = "quizzes";
  } else if (type === "flashcard") {
    collection = "flashcards";
  } else if (type === "message") {
    collection = "messages";
  } else {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Invalid content type" }),
    };
    return;
  }

  const content = await db
    .collection(collection)
    .find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection(collection).countDocuments();

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      content,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }),
  };
}

/**
 * Delete content
 */
async function deleteContent(context, req, db) {
  const { type, contentId } = req.body;

  if (!type || !contentId) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "type and contentId required" }),
    };
    return;
  }

  let collection;
  if (type === "quiz") {
    collection = "quizzes";
  } else if (type === "flashcard") {
    collection = "flashcards";
  } else if (type === "message") {
    collection = "messages";
  } else {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Invalid content type" }),
    };
    return;
  }

  await db.collection(collection).deleteOne({ _id: new ObjectId(contentId) });

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      message: "Content deleted successfully",
    }),
  };
}

/**
 * Get reports (flagged AI content)
 */
async function getReports(context, req, db) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  const status = req.query.status || "pending"; // pending, resolved, dismissed

  // Find activities flagged as problematic AI content
  const reports = await db
    .collection("activities")
    .find({
      type: { $in: ["ai.content_flagged", "user.report"] },
      "meta.status": status,
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection("activities").countDocuments({
    type: { $in: ["ai.content_flagged", "user.report"] },
    "meta.status": status,
  });

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }),
  };
}

/**
 * Resolve report
 */
async function resolveReport(context, req, db) {
  const { reportId, resolution, action } = req.body; // resolution: 'resolved', 'dismissed'

  if (!reportId || !resolution) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "reportId and resolution required" }),
    };
    return;
  }

  await db.collection("activities").updateOne(
    { _id: new ObjectId(reportId) },
    {
      $set: {
        "meta.status": resolution,
        "meta.resolvedAt": new Date(),
        "meta.action": action,
      },
    }
  );

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      message: "Report resolved successfully",
    }),
  };
}

/**
 * Get system health
 */
async function getSystemHealth(context, req, db) {
  // Database stats
  const stats = await db.stats();

  // Collection counts
  const collections = await db.listCollections().toArray();
  const collectionStats = {};

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    collectionStats[col.name] = count;
  }

  // Recent errors (from activities)
  const recentErrors = await db
    .collection("activities")
    .find({
      type: { $regex: /error|failed/i },
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  context.res = {
    status: 200,
    body: JSON.stringify({
      success: true,
      system: {
        database: {
          size: stats.dataSize,
          collections: stats.collections,
          indexes: stats.indexes,
        },
        collectionStats,
        recentErrors,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    }),
  };
};

/**
 * Send notification to users
 */
async function sendNotification(context, req, db, adminUser) {
  const { title, message, targetUsers, type } = req.body;

  if (!title || !message) {
    context.res = { status: 400, body: JSON.stringify({ error: "Title and message required" }) };
    return;
  }

  try {
    // Build user query based on target
    let userQuery = {};
    if (targetUsers === "active") {
      // Users active in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      userQuery = { lastLogin: { $gte: sevenDaysAgo } };
    } else if (targetUsers === "inactive") {
      // Users inactive for more than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      userQuery = { $or: [{ lastLogin: { $exists: false } }, { lastLogin: { $lt: thirtyDaysAgo } }] };
    }
    // "all" means no filter

    // Get target users
    const users = await db.collection("users").find(userQuery).toArray();

    // Create notifications
    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      type: type || "info",
      read: false,
      createdAt: new Date(),
      createdBy: adminUser._id,
    }));

    if (notifications.length > 0) {
      await db.collection("notifications").insertMany(notifications);
    }

    // Log admin action
    await db.collection("adminLogs").insertOne({
      action: "send_notification",
      adminId: adminUser._id,
      details: {
        title,
        targetUsers,
        recipientCount: notifications.length,
        type,
      },
      timestamp: new Date(),
    });

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        sentTo: notifications.length,
        message: `Notification sent to ${notifications.length} users`,
      }),
    };
  } catch (error) {
    context.log("Error sending notification:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to send notification" }),
    };
  }
}
