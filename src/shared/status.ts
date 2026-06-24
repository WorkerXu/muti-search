export const PANE_STATUSES = [
  'unloaded',
  'loading',
  'ready',
  'warm',
  'released',
  'login_required',
  'sending',
  'sent',
  'manual_required',
  'error',
  'disabled'
] as const;

export type PaneStatus = (typeof PANE_STATUSES)[number];

export type PaneState = {
  enabled: boolean;
  selected: boolean;
  status: PaneStatus;
  errorMessage: string | null;
};

export const statusLabels = Object.freeze({
  unloaded: '未加载',
  loading: '加载中',
  ready: '就绪',
  warm: '已预热',
  released: '已释放',
  login_required: '需登录',
  sending: '发送中',
  sent: '已发送',
  manual_required: '需人工处理',
  error: '失败',
  disabled: '已关闭'
} satisfies Record<PaneStatus, string>);

export function createInitialPaneState(): PaneState {
  return {
    enabled: true,
    selected: true,
    status: 'unloaded',
    errorMessage: null
  };
}
