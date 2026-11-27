import { readFileSync } from 'node:fs';

const png = readFileSync(new URL('./assets/icon.png', import.meta.url));
const svg = readFileSync(new URL('./assets/icon.svg', import.meta.url));
export const ICONS = [
  { src: `data:image/png;base64,${png.toString('base64')}`, mimeType: 'image/png', sizes: ['1024x1024'] },
  { src: `data:image/svg+xml;base64,${svg.toString('base64')}`, mimeType: 'image/svg+xml', sizes: ['any'] },
];

export const BRANDING = {
  title: process.env.UI_CRAFT_RELEASE_BUILD === '1' ? 'UI Craft' : 'UI Craft — local prototype',
  description: 'Local design-quality tools and opt-in Skills over MCP.',
  websiteUrl: 'https://ui-craft.smoothui.dev',
  icons: ICONS,
};

export function toolAnnotations(name) {
  // Browser navigation executes page scripts and makes network requests. Never
  // present it as equivalent to the seven local/static read-only checks.
  const browser = name === 'check_fold';
  return {
    readOnlyHint: !browser,
    destructiveHint: false,
    idempotentHint: !browser,
    openWorldHint: browser,
  };
}
