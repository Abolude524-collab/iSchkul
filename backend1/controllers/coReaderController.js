const Document = require('../models/Document');
const ChatHistory = require('../models/ChatHistory');
const openaiService = require('../services/openai');
const vectorDB = require('../services/vectorDB');
const { v4: uuidv4 } = require('uuid');

exports.chat = async (req, res) => {
    try {
        const { documentId, message, context, options } = req.body;
        const userId = req.user.id;

        // 1. Fetch Document Metadata
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // 2. Generate Embedding for Query
        const queryEmbedding = await openaiService.generateEmbedding(message);

        if (!queryEmbedding) {
            console.warn('⚠️  Could not generate embedding for query. Aborting chat request.');
            return res.status(503).json({
                error: 'AI service temporarily unavailable',
                details: 'Unable to process query due to embedding service quota or outage.'
            });
        }

        // 3. Vector Search (RAG)
        const similarChunks = await vectorDB.queryVectors(
            queryEmbedding,
            document.vectorIndexId,
            5 // Top K
        );

        // 4. Construct System Prompt
        const contextText = similarChunks.map(chunk =>
            `[Page ${chunk.metadata.pageNumber}]\n${chunk.metadata.text}`
        ).join('\n\n');

        const systemPrompt = `You are the AI Co-Reader for iSchkul. You help students understand their course materials.
    
CONTEXT FROM DOCUMENT "${document.title}":
${contextText}

INSTRUCTIONS:
- Answer based ONLY on the provided context.
- Cite page numbers in [Page X] format inline with your answer.
- If information is not in context, say "I don't see that information in this document".
- Use simple, student-friendly language.
- Highlight key terms in **bold**.
- Current Page context: Student is on Page ${context.currentPage || 'unknown'}.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...context.previousMessages, // Ensure this is sanitized/limited in length
            { role: 'user', content: message }
        ];

        // 5. Stream Response
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let stream;
        try {
            stream = await openaiService.generateChatCompletion(messages, { stream: true });
        } catch (error) {
            console.error('Co-Reader chat error:', error.message);
            res.status(503).json({ 
                error: 'Chat service unavailable',
                details: error.message 
            });
            return;
        }

        let fullResponse = '';
        const citations = [];
        // naive citation extraction from response could happen here, 
        // or we rely on the vector chunks metadata as "sources" used.
        // For now, we'll store the sources we found in RAG as potential citations.
        const usedSources = similarChunks.map(chunk => ({
            pageNumber: chunk.metadata.pageNumber,
            snippet: chunk.metadata.text.substring(0, 100) + '...',
            chunkId: chunk.id
        }));

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        // End stream
        res.write('data: [DONE]\n\n');
        res.end();

        // 6. Save Chat History (Async)
        // Find existing session or create new
        // We'll upsert into ChatHistory
        // Ideally we track sessionId from frontend
        // For simplicity, we just push to a history record for this document/user

        // We need to parse citations from the fullResponse if we want strict page linking
        // Regex to find [Page X]
        const citationRegex = /\[Page (\d+)\]/g;
        let match;
        const detectedCitations = [];
        while ((match = citationRegex.exec(fullResponse)) !== null) {
            detectedCitations.push({
                pageNumber: parseInt(match[1]),
                snippet: "Cited context" // placeholder
            });
        }

        await ChatHistory.updateOne(
            { userId, documentId },
            {
                $setOnInsert: { sessionId: uuidv4() },
                $push: {
                    messages: [
                        { role: 'user', content: message },
                        {
                            role: 'assistant',
                            content: fullResponse,
                            citations: detectedCitations.length > 0 ? detectedCitations : undefined
                        }
                    ]
                },
                $inc: { 'metadata.totalTokens': 0 } // usage not tracked in this snippet
            },
            { upsert: true }
        );

    } catch (error) {
        console.error('Co-Reader chat error:', error);
        // If headers already sent, we can't send JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: 'Chat failed' });
        } else {
            res.end();
        }
    }
};

exports.generatePomodoroQuiz = async (req, res) => {
    try {
        const { documentId, pagesRead, difficulty = 'medium' } = req.body;

        // 1. Fetch Document Metadata
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // 2. Retrieve context for specific pages from VectorDB
        // For MVP, we might just query for "summary of pages X, Y, Z" or retrieve chunks by metadata filter
        // Constructing a filter for multiple pages in Pinecone:
        // filter: { documentId: ..., pageNumber: { $in: pagesRead } } 
        // Pinecone filtering syntax depends on index type, assuming standard metadata filter support

        const contextChunks = await vectorDB.queryVectors(
            await openaiService.generateEmbedding("key concepts summary"), // dummy query to get content
            document.vectorIndexId,
            10, // Top 10 chunks from these pages
            {
                pageNumber: { '$in': pagesRead }
            }
        );

        const contextText = contextChunks.map(chunk => chunk.metadata.text).join('\n\n');

        // 3. Generate Quiz with OpenAI
        const prompt = `Based on the following text from "${document.title}" (Pages ${pagesRead.join(', ')}):
${contextText}

Generate 3 multiple-choice questions to test comprehension.
Difficulty: ${difficulty}

Return ONLY a JSON object with this structure:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A", // index or value
      "explanation": "..."
    }
  ]
}`;

        const completion = await openaiService.generateChatCompletion([
            { role: 'system', content: 'You are a quiz generator.' },
            { role: 'user', content: prompt }
        ], { json: true }); // Assuming json: true handles response_format if supported or we parse text

        // Parsing logic if not handled by service wrapper
        let quizData;
        const content = completion.choices[0].message.content;
        try {
            // Find JSON in content
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                quizData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } catch (e) {
            console.error("Quiz parsing error", e);
            return res.status(500).json({ error: "Failed to generate valid quiz" });
        }

        res.json(quizData);

    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({ error: 'Quiz generation failed' });
    }
};
