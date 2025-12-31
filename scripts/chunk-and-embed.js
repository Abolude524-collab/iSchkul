/**
 * PDF Chunking & Embedding Pipeline for Co-Reader (RAG)
 *
 * Process:
 * 1. Extract text from PDF
 * 2. Chunk text (configurable size + overlap)
 * 3. Generate embeddings using Azure OpenAI (text-embedding-3-small)
 * 4. Index chunks into Azure AI Search vector index
 * 5. Store metadata in Cosmos DB
 */

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { SearchClient, AzureKeyCredential: SearchKeyCredential } = require("@azure/search-documents");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

// Configuration
const CHUNK_SIZE = 1024; // tokens/characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(filePath) {
  console.log(`Extracting text from: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Chunk text into overlapping segments
 */
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.substring(i, i + size));
  }
  console.log(`Created ${chunks.length} chunks from text`);
  return chunks;
}

/**
 * Clean and normalize text
 */
function cleanText(text) {
  return text
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[^\w\s\.\,\!\?\-]/g, "") // Remove special chars
    .trim();
}

/**
 * Generate embeddings for chunks using Azure OpenAI
 */
async function generateEmbeddings(chunks, openaiClient) {
  console.log(`Generating embeddings for ${chunks.length} chunks...`);
  const embeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await openaiClient.getEmbeddings(
        "text-embedding-3-small", // Azure OpenAI embedding model
        [chunks[i]],
        { dimensions: 1536 }
      );
      embeddings.push(response.data[0].embedding);
      console.log(`Embedded chunk ${i + 1}/${chunks.length}`);
    } catch (error) {
      console.error(`Error embedding chunk ${i}:`, error.message);
      embeddings.push(Array(1536).fill(0)); // Fallback zero vector
    }
  }

  return embeddings;
}

/**
 * Index chunks into Azure AI Search
 */
async function indexChunksToAISearch(chunks, embeddings, searchClient, metadata) {
  console.log(`Indexing ${chunks.length} chunks to Azure AI Search...`);

  const documents = chunks.map((chunk, idx) => ({
    id: `${metadata.documentId}-chunk-${idx}`,
    chunk_text: chunk,
    vector: embeddings[idx],
    document_id: metadata.documentId,
    source_file: metadata.sourceFile,
    chunk_index: idx,
    upload_date: new Date().toISOString(),
  }));

  try {
    const uploadResult = await searchClient.uploadDocuments(documents);
    console.log(`Indexed ${uploadResult.results.length} documents to AI Search`);
    return documents;
  } catch (error) {
    console.error("Error indexing to AI Search:", error.message);
    throw error;
  }
}

/**
 * Store metadata in Cosmos DB
 */
async function storeMetadataInCosmos(chunks, documentId, sourceFile, mongoClient) {
  console.log(`Storing metadata in Cosmos DB...`);

  const db = mongoClient.db(process.env.COSMOS_DB_NAME);
  const chunksCollection = db.collection("document_chunks");

  const chunkDocs = chunks.map((chunk, idx) => ({
    _id: `${documentId}-chunk-${idx}`,
    documentId,
    chunkIndex: idx,
    text: chunk,
    sourceFile,
    createdAt: new Date(),
    status: "indexed",
  }));

  const result = await chunksCollection.insertMany(chunkDocs);
  console.log(`Stored ${result.insertedCount} chunk records in Cosmos DB`);

  // Store document metadata
  const docsCollection = db.collection("documents");
  await docsCollection.insertOne({
    _id: documentId,
    fileName: sourceFile,
    totalChunks: chunks.length,
    uploadedAt: new Date(),
    status: "processed",
    aiSearchIndexed: true,
  });

  return result;
}

/**
 * Main pipeline
 */
async function processPDF(pdfPath) {
  console.log("=== PDF Chunking & Embedding Pipeline ===");
  console.log(`Processing: ${pdfPath}\n`);

  try {
    // 1. Extract text
    const rawText = await extractTextFromPDF(pdfPath);
    const cleanedText = cleanText(rawText);
    console.log(`Extracted ${cleanedText.length} characters\n`);

    // 2. Chunk text
    const chunks = chunkText(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`Chunk size: ${CHUNK_SIZE}, Overlap: ${CHUNK_OVERLAP}\n`);

    // 3. Initialize Azure clients
    const openaiClient = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
    );

    const searchClient = new SearchClient(
      process.env.AZURE_AI_SEARCH_ENDPOINT,
      process.env.AZURE_AI_SEARCH_INDEX,
      new SearchKeyCredential(process.env.AZURE_AI_SEARCH_KEY)
    );

    const mongoClient = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await mongoClient.connect();

    // 4. Generate embeddings
    const embeddings = await generateEmbeddings(chunks, openaiClient);
    console.log("Embeddings generated\n");

    // 5. Index to AI Search
    const documentId = uuidv4();
    const sourceFile = path.basename(pdfPath);
    const indexedDocs = await indexChunksToAISearch(chunks, embeddings, searchClient, {
      documentId,
      sourceFile,
    });
    console.log("Documents indexed to Azure AI Search\n");

    // 6. Store metadata in Cosmos DB
    await storeMetadataInCosmos(chunks, documentId, sourceFile, mongoClient);
    console.log("Metadata stored in Cosmos DB\n");

    await mongoClient.close();

    console.log("✅ Pipeline complete!");
    return { documentId, chunks: chunks.length, indexed: indexedDocs.length };
  } catch (error) {
    console.error("❌ Pipeline failed:", error);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node chunk-and-embed.js <pdf-path>");
    process.exit(1);
  }
  processPDF(pdfPath);
}

module.exports = { processPDF, extractTextFromPDF, chunkText, generateEmbeddings };
