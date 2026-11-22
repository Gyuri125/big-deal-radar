import fs from 'node:fs';
import path from 'node:path';

interface MonitorItem {
  label: string;
  url: string;
}

interface MonitorReport {
  checked_at: string;
  changed: MonitorItem[];
  added: MonitorItem[];
  errors: Array<MonitorItem & { error: string }>;
}

const root = process.cwd();
const reportPath = path.join(root, 'data', 'source-monitor-report.json');

if (!fs.existsSync(reportPath)) {
  console.log('Nincs source-monitor-report.json – nincs issue.');
  fs.writeFileSync(path.join(root, 'source-monitor-count.txt'), '0', 'utf8');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MonitorReport;
const items = report.changed.length + report.errors.length;

fs.writeFileSync(
  path.join(root, 'source-monitor-count.txt'),
  String(items),
  'utf8'
);

if (items === 0) {
  console.log('Nincs változás vagy hiba – nincs issue.');
  process.exit(0);
}

const lines = [
  `Automatikus forrásfigyelés: **${new Date(report.checked_at).toLocaleString('hu-HU')}**`,
  '',
];

if (report.changed.length > 0) {
  lines.push('## Változott források', '');
  for (const item of report.changed) {
    lines.push(`- **${item.label}** – ${item.url}`);
  }
  lines.push('');
}

if (report.errors.length > 0) {
  lines.push('## Hibák', '');
  for (const item of report.errors) {
    lines.push(`- **${item.label}** – ${item.url} – ${item.error}`);
  }
  lines.push('');
}

lines.push(
  'Ellenőrizd, hogy a változás érinti-e a radar adatait. Ha igen, frissítsd a deal adatait vagy a forrását.',
  '',
  `Érintett fájlok: \`data/source-monitor.json\`, \`data/source-hashes.json\`, \`data/source-monitor-report.json\`.`
);

fs.writeFileSync(
  path.join(root, 'source-monitor-issue.md'),
  `${lines.join('\n')}\n`,
  'utf8'
);
console.log(`Issue body elkészült (${items} elem).`);
