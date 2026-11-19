import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const required = [
  '<title>SlipMeter for Mac',
  'https://slipmeter.app/',
  'id="download-form"',
  'name="first_name"',
  'name="last_name"',
  'name="email"',
  'id="network"',
  '>SlipMeter Network<',
  '/downloads/SlipMeter-0.1.97-arm64.dmg'
];

for (const value of required) {
  if (!html.includes(value)) throw new Error(`Missing required site content: ${value}`);
}

const forbiddenNavigation = ['>ClickCoach<', 'Open ClickCoach', 'ClickCoach subscribers'];
for (const value of forbiddenNavigation) {
  if (html.includes(value)) throw new Error(`Standalone site contains forbidden cross-promotion: ${value}`);
}

for (const path of [
  'assets/slipmeter-stopwatch-icon.svg',
  'assets/slipmeter-app-preview.png',
  'assets/slipmeter-full-app.png',
  'assets/slipmeter-mini-view.png',
  'assets/slipmeter-micro-view.png',
  'assets/slipmeter-mini-timer.svg',
  'assets/slipmeter-pause-timer.png',
  'downloads/SlipMeter-0.1.97-arm64.dmg'
]) {
  if (!fs.existsSync(new URL(`../${path}`, import.meta.url))) throw new Error(`Missing required asset: ${path}`);
}

console.log('SlipMeter standalone site checks passed.');
