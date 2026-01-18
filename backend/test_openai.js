const { AzureOpenAI } = require('@azure/openai');
require('dotenv').config();

async function testOpenAIKey() {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo'; // Adjust as needed

        if (!endpoint || !apiKey) {
            throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set in environment variables');
        }

        const client = new AzureOpenAI({
            endpoint,
            apiKey,
            apiVersion: '2024-02-01', // Use appropriate API version
        });

        // Test by listing models or making a simple completion
        const models = await client.listModels();
        console.log('OpenAI key is valid. Available models:', models.data.map(m => m.id));

        // Alternatively, test with a simple chat completion
        // const result = await client.chat.completions.create({
        //     model: deployment,
        //     messages: [{ role: 'user', content: 'Hello, test message' }],
        //     max_tokens: 10,
        // });
        // console.log('Test completion:', result.choices[0].message.content);

    } catch (error) {
        console.error('Error testing OpenAI key:', error.message);
    }
}

testOpenAIKey();