import OpenAI from "openai";
import 'dotenv/config'; // Loads variables from the .env file
import chalk from "chalk"; // Package for colored terminal output

// Constants for chalk colors
const ERROR = chalk.red;
const SECTION = chalk.cyan;
const ITEM = chalk.yellow;
const WARN = chalk.magenta;
const NORMAL = chalk.white; // Or just use console.log without chalk for default color

// Check if the API key is set
if (!process.env.OPENAI_API_KEY) {
    console.error(ERROR("ERROR: API Key was not found!"));
    console.error(ERROR("Ensure that the .env file exists and contains the OPENAI_API_KEY variable."));
    process.exit(1);
} else {
  console.log(`${ITEM("env var OPENAI_API_KEY")}: ${process.env.OPENAI_API_KEY.slice(0, 4)}...${process.env.OPENAI_API_KEY.slice(-4)}`);
}

const openai = new OpenAI();

function getAssistantText(message) {
  if (typeof message.content === "string" && message.content.length > 0) {
    return message.content.trim();
  }
  return "";
}

async function run() {
  // const model = "gpt-6-astra"
  // const model = "gpt-6.1-sol"
  // const model = "gpt-6.1-terra"
  // const model = "gpt-6-sol"
  // const model = "gpt-6-luna"
  // const model = "gpt-5.6-sol"
  // const model = "gpt-5.6-terra"
  // const model = "gpt-5.6-luna"
  // const model = "chat-latest"
  const model = "gpt-6-luna"
  const promptContent = "Jakie jest najszybsze zwierzę na Ziemi?"; // Prompt content

  console.log(`${ITEM("model")}: ${model}`);

  try {
    // API call to create a chat completion
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: promptContent,
        },
      ],
      max_completion_tokens: 512,
      // reasoning_effort: none, minimal, low, medium, high, xhigh, max
      reasoning_effort: "none",
    });

    const choice = completion.choices[0];
    const message = choice.message;
    const responseText = getAssistantText(message);
    const usage = completion.usage;
    const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;

    console.log(SECTION("--- Conversation ---"));
    console.log(`${ITEM(`User`)}: "${promptContent}"`);
    console.log(`${ITEM(`Model: `)}"${responseText}"`);
    console.log(SECTION("--- Usage Statistics ---"));
    console.log(NORMAL(`Prompt tokens (input): ${usage.prompt_tokens}`));
    console.log(NORMAL(`Completion tokens (output): ${usage.completion_tokens}`));
    if (reasoningTokens > 0) {
      console.log(NORMAL(`Reasoning tokens (hidden): ${reasoningTokens}`));
    }
    console.log(NORMAL(`Total tokens: ${usage.total_tokens}`));
    console.log(NORMAL(`Success: Connection and API call are working correctly! 🎉`));

  } catch (error) {
    // Handling API errors
    console.error(ERROR("\n--- API ERROR ---"));
    console.error(ERROR(error.message)); 
    console.log(ERROR("An error occurred. Check the status of your API key and payment plan."));
  }
}

run();