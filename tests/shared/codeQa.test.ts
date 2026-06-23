import { describe, expect, it } from 'vitest';
import {
  buildCodeQaExtractScript,
  buildCodeQaSendScript,
  formatCodeQaMarkdownExport,
  getCodeQaSiteConfig,
  type CodeQaExportRound
} from '../../src/shared/codeQa';

describe('codeQaSiteConfigs', () => {
  it('uses the expected selectors for every code site', () => {
    expect(getCodeQaSiteConfig('zread').followUpInputSelectors).toEqual([
      'textarea[placeholder="提出后续问题..."]'
    ]);
    expect(getCodeQaSiteConfig('deepwiki').firstQuestionInputSelectors).toEqual([
      'textarea[data-deepwiki-input="question"]'
    ]);
    expect(getCodeQaSiteConfig('deepwiki').followUpInputSelectors).toEqual([
      'textarea[data-deepwiki-input="followup"]'
    ]);
    expect(getCodeQaSiteConfig('codewiki').submitSelectors).toEqual([
      'button[data-test-id="send-message-button"]'
    ]);
  });

  it('adds Ask AI activation for zread before sending', () => {
    const script = buildCodeQaSendScript({
      siteId: 'zread',
      question: '这个项目的核心架构是什么？',
      isFollowUp: false
    });

    expect(script).toContain('Ask AI');
    expect(script).toContain('textarea[placeholder="提出后续问题..."]');
    expect(script).toContain('button[aria-label="Send message"]');
  });

  it('switches deepwiki between question and followup selectors', () => {
    const firstRound = buildCodeQaSendScript({
      siteId: 'deepwiki',
      question: '第一问',
      isFollowUp: false
    });
    const followUp = buildCodeQaSendScript({
      siteId: 'deepwiki',
      question: '第二问',
      isFollowUp: true
    });

    expect(firstRound).toContain('textarea[data-deepwiki-input="question"]');
    expect(followUp).toContain('textarea[data-deepwiki-input="followup"]');
    expect(buildCodeQaExtractScript({ siteId: 'deepwiki', question: '第二问' })).toContain(
      'data-deepwiki-answer'
    );
  });
});

describe('formatCodeQaMarkdownExport', () => {
  it('exports repository name, multiple rounds, generating state and site errors', () => {
    const rounds: CodeQaExportRound[] = [
      {
        id: 'round-1',
        repository: 'obra/superpowers',
        question: '第一问',
        createdAt: '2026-06-23T09:00:00.000Z',
        entries: {
          zread: {
            siteId: 'zread',
            siteName: 'Zread',
            status: 'completed',
            answerText: 'Zread answer',
            errorMessage: null,
            updatedAt: '2026-06-23T09:00:02.000Z'
          },
          deepwiki: {
            siteId: 'deepwiki',
            siteName: 'DeepWiki',
            status: 'generating',
            answerText: 'partial answer',
            errorMessage: null,
            updatedAt: '2026-06-23T09:00:03.000Z'
          },
          codewiki: {
            siteId: 'codewiki',
            siteName: 'CodeWiki',
            status: 'error',
            answerText: '',
            errorMessage: '429 Too Many Requests',
            updatedAt: '2026-06-23T09:00:04.000Z'
          }
        }
      },
      {
        id: 'round-2',
        repository: 'obra/superpowers',
        question: '第二问',
        createdAt: '2026-06-23T09:10:00.000Z',
        entries: {
          zread: {
            siteId: 'zread',
            siteName: 'Zread',
            status: 'completed',
            answerText: 'Zread follow-up',
            errorMessage: null,
            updatedAt: '2026-06-23T09:10:02.000Z'
          },
          deepwiki: {
            siteId: 'deepwiki',
            siteName: 'DeepWiki',
            status: 'completed',
            answerText: 'DeepWiki follow-up',
            errorMessage: null,
            updatedAt: '2026-06-23T09:10:03.000Z'
          },
          codewiki: {
            siteId: 'codewiki',
            siteName: 'CodeWiki',
            status: 'manual_required',
            answerText: '',
            errorMessage: '服务视图未就绪',
            updatedAt: '2026-06-23T09:10:04.000Z'
          }
        }
      }
    ];

    const markdown = formatCodeQaMarkdownExport(
      'obra/superpowers',
      rounds,
      new Date('2026-06-23T09:30:00.000Z')
    );

    expect(markdown).toContain('# muti-search 代码问答导出');
    expect(markdown).toContain('- 仓库：obra/superpowers');
    expect(markdown).toContain('## 第 1 轮');
    expect(markdown).toContain('## 第 2 轮');
    expect(markdown).toContain('### DeepWiki');
    expect(markdown).toContain('状态：生成中');
    expect(markdown).toContain('partial answer');
    expect(markdown).toContain('错误：429 Too Many Requests');
    expect(markdown).toContain('错误：服务视图未就绪');
  });
});
