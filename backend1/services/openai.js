const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateEmbedding = async (text) => {
    try {
        // Try OpenAI first
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002', // Lower cost, good performance
            input: text.replace(/\n/g, ' '),
        });
        console.log('[openai] ✅ Embedding generated with OpenAI');
        return response.data[0].embedding;
    } catch (error) {
        // Handle quota errors - fallback to Gemini
        if (error.status === 429) {
            console.warn('⚠️  OpenAI quota exceeded. Falling back to Gemini for embeddings...');
            try {
                return await generateEmbeddingWithGemini(text);
            } catch (geminiError) {
                // Both APIs failed - return null to indicate failure
                console.error('❌ Both OpenAI and Gemini embeddings failed');
                console.warn('💡 Document will be uploaded without embeddings. Vector search will not work.');
                return null;
            }
        }
        console.error('OpenAI embedding error:', error.message);
        // For other errors, also return null gracefully
        return null;
    }
};

/**
 * Generate embedding using Google Gemini API as fallback
 * Gemini doesn't have native embeddings, so we use text-to-embedding via embedContent API
 */
async function generateEmbeddingWithGemini(text) {
    try {
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

        const result = await model.embedContent(text.replace(/\n/g, ' '));

        if (result && result.embedding && result.embedding.values) {
            console.log('[gemini] ✅ Embedding generated with Gemini (fallback)');
            return result.embedding.values;
        } else {
            throw new Error('Gemini embedContent returned invalid format');
        }
    } catch (error) {
        console.error('❌ Gemini embedding error:', error.message);
        // Return null instead of throwing - let caller decide what to do
        return null;
    }
}

exports.generateChatCompletion = async (messages, options = {}) => {
    try {
        const { stream = false, ...otherOptions } = options;
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            stream,
            ...otherOptions,
        });
        return response;
    } catch (error) {
        console.error('❌ OpenAI chat completion error:', error.message);
        
        // Fallback to Gemini on quota exceeded or other errors
        if (error.status === 429 || error.code === 'insufficient_quota') {
            console.log('🔄 OpenAI quota exceeded, falling back to Gemini...');
            return await generateChatCompletionWithGemini(messages, options);
        }
        
        throw error;
    }
};

/**
 * Fallback chat completion using Google Gemini
 */
const generateChatCompletionWithGemini = async (messages, options = {}) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        // Build the conversation history for Gemini
        // Gemini expects a flat list of messages alternating user/model
        const history = [];
        let systemPrompt = '';
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else if (msg.role === 'user') {
                history.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.role === 'assistant') {
                history.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }
        
        // Get the last user message (current query)
        const lastUserMessage = messages[messages.length - 1];
        if (!lastUserMessage || lastUserMessage.role !== 'user') {
            throw new Error('Last message must be from user');
        }
        
        // Combine system prompt with user message if present
        let userContent = lastUserMessage.content;
        if (systemPrompt) {
            userContent = `${systemPrompt}\n\n${userContent}`;
        }
        
        if (options.stream) {
            // For streaming, return an async generator that mimics OpenAI format
            const chat = model.startChat({ history });
            const streamResponse = await chat.sendMessageStream(userContent);
            
            return {
                async *[Symbol.asyncIterator]() {
                    for await (const chunk of streamResponse.stream) {
                        const text = chunk.text();
                        if (text) {
                            // Yield in OpenAI-compatible format
                            yield {
                                choices: [{ delta: { content: text } }]
                            };
                        }
                    }
                }
            };
        } else {
            // Non-streaming response
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(userContent);
            const text = result.response.text();
            
            // Return in OpenAI-compatible format
            return {
                choices: [{ 
                    message: { content: text }
                }]
            };
        }
    } catch (error) {
        console.error('❌ Gemini fallback chat error:', error.message);
        throw new Error(`Chat service unavailable: ${error.message}`);
    }
};
