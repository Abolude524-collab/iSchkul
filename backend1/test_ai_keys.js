const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testOpenAI() {
  console.log('\n--- Testing OpenAI API ---');
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    console.log('❌ OpenAI API Key is missing in .env');
    return false;
  }

  console.log(`Using Key: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "OpenAI Key is Working"' }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ OpenAI Response:', response.data.choices[0].message.content.trim());
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ OpenAI Error (${error.response.status}):`, error.response.data.error.message);
      if (error.response.status === 429) {
        console.log('   Note: This usually means you have exceeded your quota or rate limit.');
      }
    } else {
      console.log('❌ OpenAI Error:', error.message);
    }
    return false;
  }
}

async function testGemini() {
  console.log('\n--- Testing Google Gemini API ---');
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    console.log('❌ Gemini API Key is missing in .env');
    return false;
  }

  console.log(`Using Key: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent('Say "Gemini Key is Working"');
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini Response:', text.trim());
    return true;
  } catch (error) {
    console.log('❌ Gemini Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting AI Key Validation Script');
  console.log('====================================');
  
  const openAIResult = await testOpenAI();
  const geminiResult = await testGemini();
  
  console.log('\n====================================');
  console.log('📊 FINAL SUMMARY:');
  console.log(`   OpenAI: ${openAIResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`   Gemini: ${geminiResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log('====================================\n');
}

runTests();
