const { generateText } = require('ai');

// Test what the usage object contains
async function testUsage() {
  try {
    // This won't actually run without API keys, but we can check the return type
    const result = await generateText({
      model: { apiName: 'test' },
      prompt: 'test',
    });

    console.log('Result structure:', Object.keys(result));
    console.log('Usage structure:', typeof result.usage);
  } catch (e) {
    console.log('Expected error (no API key):', e.message);
  }
}

testUsage();
