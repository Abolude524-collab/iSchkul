const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAIKey() {
    try {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY must be set in environment variables');
        }

        const openai = new OpenAI({
            apiKey: apiKey,
        });

        // Test by listing models
        const models = await openai.models.list();
        console.log('OpenAI key is valid. Available models:', models.data.map(m => m.id));

        // Alternatively, test with a simple chat completion
        // const completion = await openai.chat.completions.create({
        //     model: 'gpt-3.5-turbo',
        //     messages: [{ role: 'user', content: 'Hello, test message' }],
        //     max_tokens: 10,
        // });
        // console.log('Test completion:', completion.choices[0].message.content);

    } catch (error) {
        console.error('Error testing OpenAI key:', error.message);
    }
}

testOpenAIKey();