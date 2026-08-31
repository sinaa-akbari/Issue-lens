import type OpenAI from 'openai';
import { llm, MODEL } from './llm.js';
import { TOOLS_BY_NAME, toolDefinitions } from './tools.js';

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_STEPS = 8;

const TOOL_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You answer questions about GitHub issues stored in a database.

You cannot see the issues directly. Use the tools to look things up, then
answer from what they return. Never invent issue numbers, titles or counts.

Dates in the database are when an issue was OPENED on GitHub, not when it was
downloaded. If the user asks about a time period, use countIssues without a
date filter first to learn what range of data actually exists.

Be concise. Quote issue numbers as #1234.`;

async function runTool(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): Promise<{ id: string; name: string; content: string; ms: number }> {
  const started = Date.now();
  const name = call.type === 'function' ? call.function.name : 'unknown';
  const rawArgs = call.type === 'function' ? call.function.arguments : '{}';

  const fail = (message: string) => ({
    id: call.id,
    name,
    content: JSON.stringify({ error: message }),
    ms: Date.now() - started,
  });

  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return fail(`No tool named "${name}". Available: ${[...TOOLS_BY_NAME.keys()].join(', ')}`);

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(rawArgs || '{}');
  } catch {
    return fail(`Arguments were not valid JSON: ${rawArgs.slice(0, 200)}`);
  }

  const validated = tool.schema.safeParse(parsedArgs);
  if (!validated.success) {
    return fail(
      `Invalid arguments: ${validated.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`,
    );
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      tool.run(validated.data),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${TOOL_TIMEOUT_MS}ms`)), TOOL_TIMEOUT_MS);
      }),
    ]);
    return { id: call.id, name, content: JSON.stringify(result), ms: Date.now() - started };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runAgent(question: string): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefinitions(),
    });

    const usage = response.usage;
    console.log(
      `\n── step ${step}/${MAX_STEPS}  ` +
        `tokens in=${usage?.prompt_tokens ?? '?'} out=${usage?.completion_tokens ?? '?'}`,
    );

    const message = response.choices[0]?.message;
    if (!message) throw new Error('Model returned no choices');

    messages.push(message);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return message.content ?? '(the model returned nothing)';
    }

    const results = await Promise.all(toolCalls.map(runTool));

    for (const r of results) {
      const call = toolCalls.find((c) => c.id === r.id);
      const args = call?.type === 'function' ? call.function.arguments : '';
      console.log(`   ${r.name}(${args.slice(0, 120)})  ${r.ms}ms  → ${r.content.slice(0, 120)}`);

      messages.push({ role: 'tool', tool_call_id: r.id, content: r.content });
    }
  }

  return `Stopped after ${MAX_STEPS} steps without a final answer. The model kept asking for tools.`;
}
