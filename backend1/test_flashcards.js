require('dotenv').config();
const { generateFlashcardsFromText } = require('./utils/flashcardGen');

async function testFlashcardGeneration() {
    try {
        const sampleText = `
        Machine learning is a subset of artificial intelligence that involves training algorithms to recognize patterns in data.
        It uses statistical techniques to give computer systems the ability to "learn" without being explicitly programmed.
        There are three main types: supervised learning, unsupervised learning, and reinforcement learning.
        Supervised learning uses labeled data to train models, while unsupervised learning finds patterns in unlabeled data.
        Reinforcement learning involves agents learning through trial and error with rewards and penalties.
        `;

        console.log('Testing flashcard generation with sample text...');
        const flashcards = await generateFlashcardsFromText(sampleText, 5);

        console.log('Generated flashcards:');
        flashcards.forEach((fc, index) => {
            console.log(`${index + 1}. Q: ${fc.question}`);
            console.log(`   A: ${fc.answer}`);
            console.log('');
        });

        console.log(`Total flashcards generated: ${flashcards.length}`);

    } catch (error) {
        console.error('Error testing flashcard generation:', error.message);
    }
}

testFlashcardGeneration();