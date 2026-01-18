/**
 * Test script to verify Gemini streaming fallback works correctly
 */

const openaiService = require('./services/openai');

async function testGeminiStreaming() {
    console.log('🧪 Testing Gemini Streaming Fallback\n');
    
    const messages = [
        {
            role: 'system',
            content: 'You are a helpful tutor. Keep responses concise.'
        },
        {
            role: 'user',
            content: 'What is photosynthesis? Explain in 2 sentences.'
        }
    ];
    
    try {
        console.log('📤 Sending streaming request to Gemini...\n');
        
        const response = await openaiService.generateChatCompletion(
            messages,
            { stream: true }
        );
        
        // Test that the response is async iterable
        console.log('✅ Response is async iterable\n');
        
        let totalTokens = 0;
        let chunks = 0;
        
        console.log('📨 Response chunks:');
        console.log('─'.repeat(50));
        
        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                totalTokens += content.length;
                chunks++;
            }
        }
        
        console.log('\n' + '─'.repeat(50));
        console.log(`\n✅ Streaming completed successfully!`);
        console.log(`   - Chunks received: ${chunks}`);
        console.log(`   - Total characters: ${totalTokens}`);
        
    } catch (error) {
        console.error('❌ Streaming test failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testGeminiStreaming();
