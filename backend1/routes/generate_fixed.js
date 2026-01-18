// INSTRUCTIONS: Replace the content in generate.js with this fixed version
// Key fixes:
// 1. Gemini model: gemini-2.5-flash (WORKING - tested Jan 2026)
// 2. Better text cleaning to remove newlines and numbers
// 3. Improved sentence extraction and formatting

// Find line 59 and replace:
sentences = contentText.split(/[.!?]+/).filter(s => s.trim().length > 20);

// WITH:
const cleanText = contentText.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
sentences = cleanText.split(/[.!?]+/)
  .map(s => s.trim())
  .filter(s => s.length > 30 && s.length < 200 && !s.match(/^\d+$/));

// Find line ~330 (Gemini model) and replace:
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

// WITH:
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Find the content-specific questions section (around line 186) and replace the entire block:
// FROM:
      if (sentences.length >= numQuestions) {
        for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
          const sentence = sentences[i].trim();
          if (sentence.length > 30) {
            templates.push({
              question: `Based on the text, which statement is accurate about the content?`,
              options: [
                sentence.substring(0, 100),
                sentences[(i + 1) % sentences.length]?.substring(0, 100) || 'Alternative statement',
                sentences[(i + 2) % sentences.length]?.substring(0, 100) || 'Different concept',
                'None of these are mentioned'
              ],
              correctAnswer: 0,
              explanation: `This is directly stated in the source material: "${sentence.substring(0, 150)}..."`
            });
          }
        }
      }

// TO:
      if (sentences.length >= numQuestions) {
        for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
          const sentence = sentences[i].trim();
          if (sentence.length > 30 && sentence.length < 150) {
            // Clean sentences for options
            const cleanSentence = (s) => s.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ').trim();
            
            templates.push({
              question: `According to the material, which of the following statements is accurate?`,
              options: [
                cleanSentence(sentence),
                cleanSentence(sentences[(i + 1) % sentences.length] || 'Alternative explanation'),
                cleanSentence(sentences[(i + 2) % sentences.length] || 'Different concept'),
                'None of the above statements are correct'
              ],
              correctAnswer: 0,
              explanation: `This statement is directly found in the text: "${cleanSentence(sentence).substring(0, 100)}..."`
            });
          }
        }
      }
