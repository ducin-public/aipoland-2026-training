import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Please set the ANTHROPIC_API_KEY environment variable.');
}
console.log(
  `env var "ANTHROPIC_API_KEY" is: ${process.env.ANTHROPIC_API_KEY.slice(0, 4)}...${process.env.ANTHROPIC_API_KEY.slice(-4)}`
);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getAssistantText(content) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

async function run() {
  // const model = 'claude-opus-5-5';
  // const model = 'claude-sonnet-5-5';
  // const model = 'claude-haiku-5-5';
  // const model = 'claude-fable-5-2';
  // const model = 'claude-mythos-5-2';
  const model = 'claude-haiku-5-5';

  const conversationHistory = [
    { role: 'user', content: 'Proszę, napisz mi świetny dowcip programistyczny z którego wszyscy się będą śmiali, nawet moja babcia.' },
    { role: 'assistant', content: "Dlaczego programista nie lubi chodzić do restauracji?\nBo zawsze sprawdza \"if\" (warunek) przed zamówieniem." },
    { role: 'user', content: 'Ten żart był głupi i nudny. Poproszę o lepszy żart, który będzie faktycznie zabawny.' },
  ];

  const MAX_TOKENS = 512;

  try {
    const response = await client.messages.create({
      max_tokens: MAX_TOKENS,
      messages: conversationHistory,
      model,
      // thinking: disabled | enabled (budget_tokens)
      thinking: { type: 'disabled' },
    });

    const responseText = getAssistantText(response.content);
    const thinkingTokens = response.usage.output_tokens_details?.thinking_tokens ?? 0;

    console.log('--- Conversation (last reply) ---');
    console.log(responseText || '(brak bloku type: "text" — sprawdź thinking / max_tokens)');

    console.log('--- Usage Statistics ---');
    console.log(`Input tokens: ${response.usage.input_tokens}`);
    console.log(`Output tokens: ${response.usage.output_tokens}`);
    if (thinkingTokens > 0) {
      console.log(`Thinking tokens: ${thinkingTokens}`);
    }
    console.log(`Stop reason: ${response.stop_reason}`);
    console.log('Success: Connection and API call are working correctly! 🎉');
  } catch (error) {
    console.error('\n--- API ERROR ---');
    console.error(error.message);
  }
}

run();