const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGeminiStable() {
  const modelsToTry = [
    'gemini-2.5-flash',        // Latest stable
    'gemini-2.0-flash',        // Also stable
    'gemini-flash-latest',     // Auto-updates
    'gemini-pro-latest',       // Pro version
    'gemini-2.5-pro'          // Pro if you need it
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`\n=== Testing model: ${modelName} ===`);
      
      if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY not found in environment variables');
        return;
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `Generate a simple multiple-choice question about mathematics. Return ONLY valid JSON in this format:
{
  "question": "What is 2 + 2?",
  "options": ["3", "4", "5", "6"],
  "correctAnswer": 1,
  "explanation": "2 + 2 equals 4"
}`;

      console.log('Sending request to Gemini API...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ SUCCESS with model: ${modelName}`);
      console.log('Response:', text.substring(0, 300));
      
      // Try to parse as JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('\n✅ Successfully parsed JSON');
        }
      } catch (e) {
        console.log('⚠️ Response is not valid JSON, but API call succeeded');
      }
      
      console.log(`\n🎉 WORKING MODEL FOUND: ${modelName}`);
      return modelName; // Return the first working model
      
    } catch (error) {
      console.error(`❌ Failed with ${modelName}:`, error.message.split('\n')[0]);
    }
  }
  
  console.log('\n❌ No working models found. Check your API key or try requesting access to Gemini models.');
}

// Also list available models
async function listModels() {
  try {
    console.log('\n--- Available Gemini Models ---');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Note: The SDK may not have listModels in older versions
    console.log('Stable models you can use:');
    console.log('- gemini-pro (text generation)');
    console.log('- gemini-pro-vision (text + images)');
    console.log('\nNewer models (may require API key with access):');
    console.log('- gemini-1.5-pro');
    console.log('- gemini-1.5-flash');
    
  } catch (error) {
    console.log('Could not list models:', error.message);
  }
}

testGeminiStable().then(() => listModels());
