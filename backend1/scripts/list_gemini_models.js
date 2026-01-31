const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listAvailableModels() {
  try {
    console.log('Checking Gemini API Key and listing available models...\n');
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not found in .env file');
      return;
    }

    console.log('✅ GEMINI_API_KEY found');
    console.log('Key preview:', process.env.GEMINI_API_KEY.substring(0, 10) + '...\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Try to call the list models endpoint directly
    const apiKey = process.env.GEMINI_API_KEY;
    const axios = require('axios');
    
    console.log('Fetching available models from Google AI...');
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.data && response.data.models) {
      console.log('\n✅ Available Gemini Models:\n');
      
      const textModels = response.data.models.filter(m => 
        m.supportedGenerationMethods?.includes('generateContent')
      );
      
      if (textModels.length === 0) {
        console.log('⚠️ No models with generateContent support found');
        console.log('All models:');
        response.data.models.forEach(model => {
          console.log(`  - ${model.name} (${model.supportedGenerationMethods?.join(', ')})`);
        });
      } else {
        textModels.forEach(model => {
          const modelName = model.name.replace('models/', '');
          console.log(`✅ ${modelName}`);
          console.log(`   Display: ${model.displayName}`);
          console.log(`   Description: ${model.description || 'N/A'}`);
          console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
          console.log('');
        });
        
        console.log('\n📝 RECOMMENDED MODELS TO USE:\n');
        const recommended = textModels[0].name.replace('models/', '');
        console.log(`Use this in your code: '${recommended}'`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      console.error('\nAPI Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.error('\n⚠️ API Key might be invalid or expired');
        console.error('   Get a new key at: https://makersuite.google.com/app/apikey');
      }
    }
  }
}

listAvailableModels();
