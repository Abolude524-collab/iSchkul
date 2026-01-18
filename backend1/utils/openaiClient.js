const OpenAI = require('openai');

let client = null;

function getClient() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn('[openaiClient] OPENAI_API_KEY not set - AI features disabled.');
    return null;
  }
  client = new OpenAI({ apiKey: key });
  return client;
}

async function createChatCompletion({ model = 'gpt-4o-mini', messages = [], max_tokens = 1500, temperature = 0.7 }) {
  const c = getClient();
  if (!c) throw new Error('OpenAI client not configured');

  // Basic retry loop for rate limits / transient errors
  const maxRetries = 4;
  let delay = 1000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await c.chat.completions.create({ model, messages, max_tokens, temperature });
      return resp;
    } catch (err) {
      const isRate = err && err.name && err.name.toLowerCase().includes('ratelimit');
      if (attempt === maxRetries - 1) throw err;
      // exponential backoff
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
      if (!isRate) {
        // still retry a couple times for transient network errors
        continue;
      }
    }
  }
}

module.exports = { createChatCompletion };