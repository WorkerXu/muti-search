export const SERVICE_IDS = [
  'chatgpt',
  'deepseek',
  'grok',
  'doubao',
  'gemini',
  'yuanbao',
  'qwen',
  'zhipu',
  'perplexity'
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
export type ServicePartition<T extends ServiceId = ServiceId> = `persist:${T}`;
export type ServiceSendConfig = Readonly<{
  inputSelectors: readonly string[];
  submitSelectors: readonly string[];
}>;

export type ServiceDefinition<T extends ServiceId = ServiceId> = Readonly<{
  id: T;
  name: string;
  url: string;
  partition: ServicePartition<T>;
  accent: string;
  send: ServiceSendConfig;
}>;

type ServiceSeed<T extends ServiceId = ServiceId> = Readonly<{
  id: T;
  name: string;
  url: string;
  accent: string;
  send: ServiceSendConfig;
}>;

const FALLBACK_INPUT_SELECTORS = Object.freeze([
  'textarea',
  '[contenteditable="true"]',
  'div[role="textbox"]'
]);

const FALLBACK_SUBMIT_SELECTORS = Object.freeze([
  'button[type="submit"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="发送"]',
  'button[data-testid*="send"]'
]);

function defineSendConfig(options?: {
  inputSelectors?: readonly string[];
  submitSelectors?: readonly string[];
}): ServiceSendConfig {
  return Object.freeze({
    inputSelectors: Object.freeze([...(options?.inputSelectors ?? FALLBACK_INPUT_SELECTORS)]),
    submitSelectors: Object.freeze([...(options?.submitSelectors ?? FALLBACK_SUBMIT_SELECTORS)])
  });
}

const serviceSeeds = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    accent: '#10a37f',
    send: defineSendConfig()
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    accent: '#2563eb',
    send: defineSendConfig()
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    accent: '#6d5bd0',
    send: defineSendConfig()
  },
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    accent: '#8b6b4f',
    send: defineSendConfig({
      inputSelectors: [
        'textarea',
        '[contenteditable="true"]',
        'div[role="textbox"]'
      ],
      submitSelectors: [
        'button[aria-label*="发送"]',
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]'
      ]
    })
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    accent: '#4285f4',
    send: defineSendConfig()
  },
  {
    id: 'yuanbao',
    name: '元宝',
    url: 'https://yuanbao.tencent.com',
    accent: '#059669',
    send: defineSendConfig()
  },
  {
    id: 'qwen',
    name: '千问',
    url: 'https://chat.qwen.ai',
    accent: '#7c3aed',
    send: defineSendConfig()
  },
  {
    id: 'zhipu',
    name: '智谱',
    url: 'https://chatglm.cn',
    accent: '#2563eb',
    send: defineSendConfig()
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
    accent: '#0e7490',
    send: defineSendConfig()
  }
] as const satisfies readonly ServiceSeed[];

function defineService<T extends ServiceId>(seed: ServiceSeed<T>): ServiceDefinition<T> {
  return Object.freeze({
    ...seed,
    partition: `persist:${seed.id}` as ServicePartition<T>
  });
}

export const services = Object.freeze(
  serviceSeeds.map((seed) => defineService(seed))
) as readonly ServiceDefinition[];

export function getService(id: string): ServiceDefinition {
  const service = services.find((item) => item.id === id);

  if (!service) {
    throw new Error(`Unknown service id: ${id}`);
  }

  return service;
}
