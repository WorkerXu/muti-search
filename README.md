# muti-search

Local Electron desktop shell for viewing 9 official AI web UIs in a 3x3 grid and sending one manually entered prompt to selected services.

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
2. Confirm the 3x3 grid loads all selected official AI pages.
3. Confirm each service keeps its own login state across app restarts.
4. Confirm `发送到已选` only targets enabled and selected services.
5. Confirm one failed service does not block the remaining services.
6. Confirm double-clicking a pane/header can enlarge and collapse the pane.
7. Confirm there is no prompt history, answer extraction panel, session-clearing UI, or keyboard shortcut layer in version 1.
