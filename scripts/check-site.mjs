import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vercel = fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const helpKnowledge = JSON.parse(fs.readFileSync(new URL('../help/knowledge-base.json', import.meta.url), 'utf8'));
const required = [
  '<title>SlipMeter for Mac',
  'https://slipmeter.app/',
  'id="download-form"',
  'name="first_name"',
  'name="last_name"',
  'name="email"',
  'id="network"',
  '>SlipMeter Network<',
  'Path from captured time to billing and accountability',
  'Ready to bill',
  'Ready to review',
  'Record work as it happens',
  'Turn records into action',
  'SlipMeter Network · Early access',
  'CSV handoff',
  'Even a simple sneakernet works',
  'manual CSV consolidation without Network',
  'id="mcp"',
  'SlipMeter MCP Server',
  'Ask your time data a useful question',
  'Secure MCP gateway',
  'Credentials are hashed, rate-limited, organization-scoped, audited, and revocable',
  'A timer still running on a computer remains private and local',
  'href="https://network.slipmeter.app/">Open SlipMeter Network',
  'id="network-map"',
  'Shared slip data',
  'Coach 06',
  'SlipMeter Network is free for the first year',
  '$9.97 per year, per license',
  'Two computer activations for one named user',
  'A ClickCoach subscription or any ClickCoach features',
  '$19.97 per month',
  'https://buy.stripe.com/6oUeVdgZ87XW57I1j74gg00',
  'https://network.slipmeter.app/api/download/register',
  'id="help-chat-launcher"',
  'SlipMeter Product Advisor',
  'Where is my data stored?',
  'How does a team get started?',
  'How would it work for my team?',
  '/help-chat.js?v=2'
];

for (const value of required) {
  if (!html.includes(value)) throw new Error(`Missing required site content: ${value}`);
}

const forbiddenNavigation = ['>ClickCoach<', 'Open ClickCoach', 'ClickCoach subscribers'];
for (const value of forbiddenNavigation) {
  if (html.includes(value)) throw new Error(`Standalone site contains forbidden cross-promotion: ${value}`);
}

for (const oldPrice of ['$29.99', '$29.95', 'per year after trial', 'Standalone annual plan']) {
  if (html.includes(oldPrice)) throw new Error(`Standalone site still contains retired pricing: ${oldPrice}`);
}

for (const header of [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy'
]) {
  if (!vercel.includes(header)) throw new Error(`Missing required security header: ${header}`);
}

for (const path of [
  'assets/slipmeter-stopwatch-icon.svg',
  'assets/slipmeter-app-preview.png',
  'assets/slipmeter-full-app.png',
  'assets/slipmeter-mini-view.png',
  'assets/slipmeter-micro-view.png',
  'assets/slipmeter-mini-timer.svg',
  'assets/slipmeter-pause-timer.png',
  'downloads/latest.json',
  'help/knowledge-base.json',
  'help-chat.js',
  'privacy/index.html',
  'terms/index.html'
]) {
  if (!fs.existsSync(new URL(`../${path}`, import.meta.url))) throw new Error(`Missing required asset: ${path}`);
}

for (const legalPath of ['/privacy', '/terms']) {
  if (!html.includes(`href="${legalPath}"`)) {
    throw new Error(`Footer must link to the standalone ${legalPath} page`);
  }
}

if (!Array.isArray(helpKnowledge.entries) || helpKnowledge.entries.length < 25) {
  throw new Error('SlipMeter chatbot knowledge base must contain at least 25 help entries');
}

const helpIds = new Set();
const helpCategories = new Set();
for (const entry of helpKnowledge.entries) {
  if (!entry.id || !entry.category || !entry.question || !entry.answer || !Array.isArray(entry.keywords)) {
    throw new Error('SlipMeter chatbot knowledge entries require id, category, question, answer, and keywords');
  }
  if (helpIds.has(entry.id)) throw new Error(`Duplicate SlipMeter chatbot help id: ${entry.id}`);
  helpIds.add(entry.id);
  helpCategories.add(entry.category);
}

for (const category of ['Timer', 'Reporting', 'Network', 'MCP', 'Pricing', 'Privacy', 'Installation']) {
  if (!helpCategories.has(category)) throw new Error(`SlipMeter chatbot is missing the ${category} help category`);
}

for (const retiredIntegration of ['app.tinyemail.com', 'formspree.io', "'unsafe-inline'", '/downloads/SlipMeter-0.1.97-arm64.dmg']) {
  if (html.includes(retiredIntegration) || vercel.includes(retiredIntegration)) {
    throw new Error(`Retired or insecure delivery integration remains: ${retiredIntegration}`);
  }
}

console.log('SlipMeter standalone site checks passed.');
