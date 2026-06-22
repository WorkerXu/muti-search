export const SERVICE_IDS = [
  'chatgpt',
  'deepseek',
  'grok',
  'doubao',
  'gemini',
  'yuanbao',
  'perplexity'
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
export type ServicePartition<T extends ServiceId = ServiceId> = `persist:${T}`;
export type ServiceSendConfig = Readonly<{
  inputSelectors: readonly string[];
  submitSelectors: readonly string[];
  mode: 'dom' | 'physical';
  submitStrategy: 'button-first' | 'enter-first' | 'button-only';
  pasteSubmitFallback: boolean;
  domFillAfterNative: boolean;
}>;

export type ServiceAnswerConfig = Readonly<{
  answerSelectors: readonly string[];
  busySelectors: readonly string[];
}>;

export type ServiceDefinition<T extends ServiceId = ServiceId> = Readonly<{
  id: T;
  name: string;
  url: string;
  partition: ServicePartition<T>;
  accent: string;
  send: ServiceSendConfig;
  answer: ServiceAnswerConfig;
}>;

type ServiceSeed<T extends ServiceId = ServiceId> = Readonly<{
  id: T;
  name: string;
  url: string;
  accent: string;
  send: ServiceSendConfig;
  answer: ServiceAnswerConfig;
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
  'button[aria-label*="提交"]',
  'button[data-testid*="send"]',
  'button[data-testid*="submit"]',
  '[id*="send"]',
  '[class*="send-button"]',
  '[class*="send-btn"]',
  '[class*="send-msg"]'
]);

const FALLBACK_ANSWER_SELECTORS = Object.freeze([
  '[data-message-author-role="assistant"]',
  '[data-turn="assistant"]',
  '[class*="markdown"]',
  '.markdown-body',
  '.prose',
  '[class*="answer"]',
  '[class*="response"]',
  'article'
]);

const FALLBACK_BUSY_SELECTORS = Object.freeze([
  '[data-testid="stop-button"]',
  'button[aria-label*="停止"]',
  'button[aria-label*="Stop"]',
  'button[aria-label*="取消"]',
  'button[aria-label*="Cancel"]',
  '[class*="stop-button"]'
]);

function defineSendConfig(options?: {
  inputSelectors?: readonly string[];
  submitSelectors?: readonly string[];
  mode?: 'dom' | 'physical';
  submitStrategy?: 'button-first' | 'enter-first' | 'button-only';
  pasteSubmitFallback?: boolean;
  domFillAfterNative?: boolean;
}): ServiceSendConfig {
  return Object.freeze({
    inputSelectors: Object.freeze([...(options?.inputSelectors ?? FALLBACK_INPUT_SELECTORS)]),
    submitSelectors: Object.freeze([...(options?.submitSelectors ?? FALLBACK_SUBMIT_SELECTORS)]),
    mode: options?.mode ?? 'dom',
    submitStrategy: options?.submitStrategy ?? 'button-first',
    pasteSubmitFallback: options?.pasteSubmitFallback ?? false,
    domFillAfterNative: options?.domFillAfterNative ?? false
  });
}

function defineAnswerConfig(options?: {
  answerSelectors?: readonly string[];
  busySelectors?: readonly string[];
}): ServiceAnswerConfig {
  return Object.freeze({
    answerSelectors: Object.freeze([...(options?.answerSelectors ?? FALLBACK_ANSWER_SELECTORS)]),
    busySelectors: Object.freeze([...(options?.busySelectors ?? FALLBACK_BUSY_SELECTORS)])
  });
}

const serviceSeeds = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    accent: '#10a37f',
    send: defineSendConfig({
      mode: 'physical',
      inputSelectors: [
        '#prompt-textarea',
        '[aria-label="与 ChatGPT 聊天"]',
        '[aria-label="Message ChatGPT"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      submitSelectors: [
        '#composer-submit-button',
        'button[data-testid="send-button"]',
        'button[aria-label*="发送"]',
        'button[aria-label*="Send"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '[data-message-author-role="assistant"]',
        '[data-turn="assistant"] [data-message-author-role="assistant"]',
        '[data-turn="assistant"]'
      ]
    })
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    accent: '#2563eb',
    send: defineSendConfig({
      inputSelectors: [
        'textarea[placeholder="给 DeepSeek 发送消息 "]',
        'textarea[name="search"]',
        'textarea'
      ],
      submitSelectors: [
        '[class*="ds-button--primary"][class*="ds-button--filled"][class*="ds-button--circle"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '.ds-assistant-message-main-content',
        '.ds-markdown.ds-assistant-message-main-content',
        '.ds-markdown'
      ],
      busySelectors: [
        '[class*="ds-button--stop"]',
        '[class*="stop"]',
        ...FALLBACK_BUSY_SELECTORS
      ]
    })
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    accent: '#6d5bd0',
    send: defineSendConfig({
      mode: 'physical',
      submitStrategy: 'button-only',
      inputSelectors: [
        '[aria-label="Ask Grok anything"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      submitSelectors: [
        'button[data-testid="chat-submit"]',
        'button[type="submit"][aria-label*="提交"]',
        'button[type="submit"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '.response-content-markdown',
        '[data-message-author-role="assistant"]',
        '[class*="assistant-message"]'
      ],
      busySelectors: [
        '[data-testid="thinking-indicator"]',
        'button[aria-label*="停止模型响应"]',
        ...FALLBACK_BUSY_SELECTORS
      ]
    })
  },
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    accent: '#8b6b4f',
    send: defineSendConfig({
      inputSelectors: [
        'textarea[placeholder="发消息..."]',
        '[contenteditable="true"]',
        'textarea',
        'div[role="textbox"]'
      ],
      submitSelectors: [
        '#flow-end-msg-send',
        'button[class*="send-msg-btn"]',
        'button[aria-label*="发送"]',
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '.md-box-root',
        '[class*="md-box-root"]',
        '[class*="container-"]'
      ],
      busySelectors: [
        '[class*="stop"]',
        '[class*="generat"]',
        ...FALLBACK_BUSY_SELECTORS
      ]
    })
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    accent: '#4285f4',
    send: defineSendConfig({
      mode: 'physical',
      inputSelectors: [
        '[aria-label="为 Gemini 输入提示"]',
        '[aria-label*="Gemini"][role="textbox"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      submitSelectors: [
        'button[aria-label="发送"]',
        'button[aria-label="发送消息"]',
        'button[aria-label*="Send"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        'message-content',
        '.model-response-text',
        '[class*="model-response"]',
        '[class*="response-content"]',
        '[class*="markdown"]'
      ],
      busySelectors: [
        'button[aria-label="停止回答"]',
        'button[aria-label*="Stop"]',
        ...FALLBACK_BUSY_SELECTORS
      ]
    })
  },
  {
    id: 'yuanbao',
    name: '元宝',
    url: 'https://yuanbao.tencent.com',
    accent: '#059669',
    send: defineSendConfig({
      mode: 'physical',
      submitStrategy: 'button-only',
      inputSelectors: [
        '[contenteditable="true"].ql-editor',
        '[contenteditable="true"]',
        'textarea'
      ],
      submitSelectors: [
        '#yuanbao-send-btn',
        'a[class*="send-btn"]',
        '[class*="icon-send"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '.hyc-common-markdown-style:not(.hyc-common-markdown-style-cot)',
        '.hyc-common-markdown:not(.hyc-common-markdown-style-cot)',
        '.hyc-common-markdown'
      ]
    })
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
    accent: '#0e7490',
    send: defineSendConfig({
      mode: 'physical',
      inputSelectors: [
        '#ask-input[contenteditable="true"]',
        '#ask-input',
        '[data-ask-input-container="true"] [contenteditable="true"][role="textbox"]',
        '[aria-placeholder*="输入"][contenteditable="true"]',
        '[aria-placeholder*="Ask"][contenteditable="true"]',
        '[data-testid="ask-input"]',
        '[aria-label*="Ask"][contenteditable="true"]',
        'textarea[placeholder*="Ask"]',
        'textarea[placeholder*="询问"]',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea'
      ],
      submitSelectors: [
        'button[aria-label="提交"]',
        'button[aria-label*="Submit"]',
        'button[type="submit"]'
      ]
    }),
    answer: defineAnswerConfig({
      answerSelectors: [
        '.prose',
        '[class*="prose"]',
        '[class*="answer"]'
      ]
    })
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
