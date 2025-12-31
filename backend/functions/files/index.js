const { BlobServiceClient } = require("@azure/storage-blob");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

module.exports = async function (context, req) {
  context.log("File upload triggered");

  if (req.method !== "POST") {
    context.res = { status: 405, body: "Method not allowed" };
    return;
  }

  const { userId } = req.body;
  const file = req.files?.file;

  if (!userId || !file) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "userId and file required" }),
    };
    return;
  }

  // Validate file type
  if (file.mimetype !== "application/pdf") {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "Only PDF files allowed" }),
    };
    return;
  }

  try {
    // Initialize Azure Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.BLOB_STORAGE_CONN
    );
    const containerClient = blobServiceClient.getContainerClient(
      process.env.BLOB_CONTAINER_UPLOADS
    );

    // Generate unique blob name
    const blobName = `documents/${uuidv4()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file
    await blockBlobClient.uploadData(file.data, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    // Store metadata in Cosmos DB
    const mongoClient = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await mongoClient.connect();

    const db = mongoClient.db(process.env.COSMOS_DB_NAME);
    const documentsCollection = db.collection("documents");

    const documentId = uuidv4();
    const document = {
      _id: documentId,
      userId,
      fileName: file.originalname,
      blobName,
      blobUrl: `https://${process.env.BLOB_STORAGE_CONN.split("//")[1].split(".")[0]}.blob.core.windows.net/${process.env.BLOB_CONTAINER_UPLOADS}/${blobName}`,
      fileSize: file.data.length,
      uploadedAt: new Date(),
      status: "uploaded", // pending-processing, indexed
      chunkCount: 0,
    };

    const result = await documentsCollection.insertOne(document);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        documentId: result.insertedId,
        message: "File uploaded. Chunking and embedding in progress.",
      }),
    };

    // Trigger chunking job (TODO: Use Azure Queue Storage or Durable Functions)
    context.log(`Document ${documentId} queued for processing`);

    await mongoClient.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Upload failed" }),
    };
  }
};
