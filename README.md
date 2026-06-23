# muti-search

Local Electron desktop shell for switching between a search workflow and a code workflow while sending one manually entered prompt to selected official AI services.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Product Boundaries

- Personal use only.
- Human-triggered send only.
- No prompt or answer history in version 1.
- No captcha bypass, background queue, or automated looping.

## Manual Verification Checklist

1. Run `npm run dev`.
2. Confirm the app defaults to the `搜索` tab and shows the service sidebar plus one large active site.
3. Confirm switching to the `代码` tab shows only the local placeholder area and does not create extra remote webviews.
4. Confirm `发送到已选` only targets enabled and selected services.
5. Confirm one failed service does not block the remaining services.
6. Confirm double-clicking a pane/header can enlarge and collapse the active site.
7. Confirm there is no grid/split toggle, prompt history, answer extraction panel, session-clearing UI, or keyboard shortcut layer in version 1.
