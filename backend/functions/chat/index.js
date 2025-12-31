const { MongoClient } = require("mongodb");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { SearchClient, AzureKeyCredential: SearchKeyCredential } = require("@azure/search-documents");

async function generateEmbedding(text) {
  const client = new OpenAIClient(
    process.env.AZURE_OPENAI_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
  );
  const response = await client.getEmbeddings("text-embedding-3-small", [text]);
  return response.data[0].embedding;
}

module.exports = async function (context, req) {
  context.log("Chat endpoint triggered");

  if (req.method !== "POST") {
    context.res = { status: 405, body: "Method not allowed" };
    return;
  }

  const { userId, content, groupId, isGroupChat } = req.body;

  if (!userId || !content) {
    context.res = { status: 400, body: JSON.stringify({ error: "userId and content required" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const messagesCollection = db.collection("messages");

    // Store message in Cosmos DB
    const newMessage = {
      userId,
      content,
      groupId: groupId || null,
      isGroupChat: isGroupChat || false,
      createdAt: new Date(),
      archived: false,
    };

    const result = await messagesCollection.insertOne(newMessage);

    // If this is a Co-Reader query (no groupId), trigger RAG retrieval and GPT-4o response
    let aiResponse = null;
    if (!groupId) {
      // Perform RAG retrieval
      const searchClient = new SearchClient(
        process.env.AZURE_AI_SEARCH_ENDPOINT,
        process.env.AZURE_AI_SEARCH_INDEX,
        new SearchKeyCredential(process.env.AZURE_AI_SEARCH_KEY)
      );

      // Vector search for relevant chunks
      const searchResults = await searchClient.search(content, {
        searchMode: "all",
        top: 3,
        vectorQueries: [{
          kind: "vector",
          vector: await generateEmbedding(content), // Need to generate embedding for query
          fields: ["contentVector"],
          k: 3
        }]
      });

      const chunks = [];
      for await (const result of searchResults.results) {
        chunks.push(result.document);
      }

      // Assemble prompt
      const systemPrompt = `You are an intelligent educational assistant. Answer questions based on the provided context from uploaded documents. If the question cannot be answered from the context, say so politely.`;
      const contextText = chunks.map(c => c.text).join('\n\n');
      const prompt = `${systemPrompt}\n\nContext:\n${contextText}\n\nQuestion: ${content}\n\nAnswer:`;

      // Call Azure OpenAI
      const openaiClient = new OpenAIClient(
        process.env.AZURE_OPENAI_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
      );

      const response = await openaiClient.getChatCompletions(process.env.AZURE_OPENAI_DEPLOYMENT, [
        { role: "user", content: prompt }
      ]);

      aiResponse = response.choices[0].message.content;

      // Store AI response as another message
      const aiMessage = {
        userId: "ai-assistant", // Special user ID for AI
        content: aiResponse,
        groupId: groupId || null,
        isGroupChat: isGroupChat || false,
        createdAt: new Date(),
        archived: false,
        sources: chunks.map(c => c.id)
      };
      await messagesCollection.insertOne(aiMessage);
    }

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        messageId: result.insertedId,
        message: newMessage,
        aiResponse: aiResponse
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};
