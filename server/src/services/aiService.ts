import { ChatAnthropic } from '@langchain/anthropic';
import { tool } from '@langchain/core/tools';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getCurrent, getForecast, geocodeCity } from './weatherService.js';
import { AIServiceError, ClarificationNeededError } from '../types/index.js';
import type { MessagePayload } from '../types/index.js';
import type pino from 'pino';
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Serialized } from '@langchain/core/load/serializable';

// ─── LangChain callback handler ───────────────────────────────────────────

class PinoCallbackHandler extends BaseCallbackHandler {
  name = 'PinoCallbackHandler';
  private readonly log: pino.Logger;
  private readonly toolStartTimes = new Map<string, number>();

  constructor(log: pino.Logger) {
    super();
    this.log = log;
  }

  override handleToolStart(_tool: Serialized, _input: string, runId: string): void {
    this.toolStartTimes.set(runId, Date.now());
    // Log tool name only — never log city names or coordinates at INFO level
    this.log.info({ event: 'tool_invoked', runId }, 'Tool invoked');
  }

  override handleToolEnd(_output: string, runId: string): void {
    const start = this.toolStartTimes.get(runId);
    const durationMs = start !== undefined ? Date.now() - start : undefined;
    this.toolStartTimes.delete(runId);
    this.log.info({ event: 'tool_completed', runId, durationMs }, 'Tool completed');
  }

  override handleToolError(err: Error, runId: string): void {
    this.toolStartTimes.delete(runId);
    this.log.error({ event: 'tool_error', runId, err }, 'Tool error');
  }
}

// ─── System prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are SkyTalk, a friendly and knowledgeable weather assistant.
Your role is to help users understand the weather in a warm, conversational way.

Rules you MUST follow:
1. EMPATHETIC ACCURACY: Always translate raw weather data into human-relevant language.
   Never just state "20% chance of rain" — interpret it: "There's a slight chance of a shower,
   so maybe keep an umbrella in the car just in case."
2. CONTEXTUAL RELEVANCE: If the user mentions an activity (BBQ, hiking, wedding), assess
   weather suitability for that specific activity — don't just recite temperature.
3. TONE: Friendly, professional, and observant — like a knowledgeable neighbor who happens
   to be a meteorologist. Consistent regardless of whether the weather is pleasant or severe.
4. SAFETY FIRST: For life-threatening events (hurricanes, tornadoes, flash floods), lead with
   official safety warnings. Suspend friendly banter — be direct, clear, and safety-focused.
5. CLARIFICATION: For city names that are shared by multiple places (e.g. "Springfield",
   "Portland", "Richmond"), use the searchLocations tool first to surface options for the
   user. For famous, globally unambiguous cities (London = London UK, Paris = Paris France,
   Tokyo = Tokyo Japan), call getCurrentWeather directly without searching first.
6. SCOPE: Politely redirect non-weather queries back to weather topics.

Always use your tools to fetch real weather data before responding. Never invent weather values.`;

// ─── LangChain tools ──────────────────────────────────────────────────────

// currentQuery is set per-invocation so searchLocations can include it in ClarificationNeededError
let _currentQuery = '';

const getCurrentWeatherTool = tool(
  async ({ city }: { city: string }) => {
    const ctx = await getCurrent(city);
    return JSON.stringify(ctx);
  },
  {
    name: 'getCurrentWeather',
    description:
      'Get current weather conditions for a specific, unambiguous city name. ' +
      'Call searchLocations first if the city name might be ambiguous.',
    schema: z.object({ city: z.string().describe('The city name to get weather for') }),
  },
);

const searchLocationsTool = tool(
  async ({ city }: { city: string }) => {
    const result = await geocodeCity(city);
    if (Array.isArray(result)) {
      // Multiple candidates — throw so the router surfaces structured disambiguation UI
      throw new ClarificationNeededError(result, _currentQuery);
    }
    // Single match — return it so the AI can call getCurrentWeather with the resolved name
    return JSON.stringify(result);
  },
  {
    name: 'searchLocations',
    description:
      'Search for matching locations when a city name is ambiguous (e.g. "Springfield", "Portland"). ' +
      'Returns candidate locations for the user to choose from, or a single resolved location. ' +
      'Do NOT call this for famous, clearly unambiguous cities like London, Paris, or Tokyo.',
    schema: z.object({
      city: z.string().describe('The ambiguous city name to search for'),
    }),
  },
);

const getForecastTool = tool(
  async ({ city, days }: { city: string; days: number }) => {
    const forecast = await getForecast(city, days);
    return JSON.stringify(forecast);
  },
  {
    name: 'getForecast',
    description: 'Get a multi-day weather forecast for a city. Use this for questions about future weather.',
    schema: z.object({
      city: z.string().describe('The city name to get the forecast for'),
      days: z.number().min(1).max(7).describe('Number of days to forecast (1–7)'),
    }),
  },
);

// ─── Agent loop ───────────────────────────────────────────────────────────

export async function runAIQuery(
  userQuery: string,
  log: pino.Logger,
  overrideLocation?: { lat: number; lon: number; displayName: string },
): Promise<MessagePayload> {
  try {
    const callbacks = [new PinoCallbackHandler(log)];
    const llm = new ChatAnthropic({
      model: 'claude-sonnet-4-6',
      streaming: false,
      callbacks,
    }).bindTools([getCurrentWeatherTool, getForecastTool, searchLocationsTool]);

    const humanText = overrideLocation
      ? `${userQuery}\n\n(The user has confirmed the location: ${overrideLocation.displayName}. Use this city name when calling weather tools.)`
      : userQuery;

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(humanText),
    ];

    // Expose query to tool so ClarificationNeededError carries the original query text
    _currentQuery = userQuery;

    log.info({ event: 'ai_query_start' }, 'Starting AI query');

    // Tool-calling loop — track last getCurrentWeather result for WeatherContext
    let lastWeatherContextJson: string | null = null;
    let response = await llm.invoke(messages);

    while (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(new AIMessage({ content: response.content, tool_calls: response.tool_calls }));

      for (const toolCall of response.tool_calls) {
        log.info({ event: 'tool_invoked', tool: toolCall.name }, 'Tool invoked');
        const start = Date.now();

        let result: string;
        if (toolCall.name === 'getCurrentWeather') {
          result = await getCurrentWeatherTool.invoke(toolCall.args as { city: string });
          lastWeatherContextJson = result;
        } else if (toolCall.name === 'getForecast') {
          result = await getForecastTool.invoke(toolCall.args as { city: string; days: number });
        } else if (toolCall.name === 'searchLocations') {
          result = await searchLocationsTool.invoke(toolCall.args as { city: string });
        } else {
          result = 'Unknown tool';
        }

        log.info({ event: 'tool_completed', tool: toolCall.name, durationMs: Date.now() - start }, 'Tool completed');

        messages.push(new ToolMessage({ tool_call_id: toolCall.id ?? '', content: result }));
      }

      response = await llm.invoke(messages);
    }

    const text = typeof response.content === 'string'
      ? response.content
      : (response.content as Array<{ text?: string }>)
          .map((c) => c.text ?? '')
          .join('');

    log.info({ event: 'ai_query_complete' }, 'AI query complete');

    // Extract WeatherContext from the getCurrentWeather tool result
    const weatherContext = lastWeatherContextJson
      ? JSON.parse(lastWeatherContextJson)
      : {
          condition: 'neutral' as const,
          location: overrideLocation?.displayName ?? 'Unknown',
          temperatureCelsius: 0,
          feelsLikeCelsius: 0,
          humidity: 0,
          windKph: 0,
          precipitationProbability: 0,
        };

    return {
      id: uuidv4(),
      role: 'ai',
      text,
      timestamp: new Date().toISOString(),
      weatherContext,
    };
  } catch (err) {
    // Let ClarificationNeededError propagate to the router for structured handling
    if ((err as ClarificationNeededError).name === 'ClarificationNeededError') {
      throw err;
    }
    log.error({ err, event: 'ai_query_error' }, 'AI query failed');
    throw new AIServiceError(
      'The AI assistant is temporarily unavailable. Please try again in a moment.',
    );
  }
}
