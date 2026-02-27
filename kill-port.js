/**
 * kill-port.js — Libera la porta 4200 prima di avviare ng serve.
 * Viene chiamato automaticamente da "npm start" (script prestart).
 */
const { execSync } = require('child_process');

const PORT = 4200;

try {
  const output = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = output.split('\n').filter(
    line => line.includes(`:${PORT}`) && line.includes('LISTENING')
  );

  if (lines.length === 0) {
    console.log(`✓ Porta ${PORT} libera`);
    process.exit(0);
  }

  const pids = new Set();
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });

  pids.forEach(pid => {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`✓ Processo ${pid} terminato (porta ${PORT})`);
    } catch (e) {
      // Il processo potrebbe essere già terminato
    }
  });

  console.log(`✓ Porta ${PORT} liberata`);
} catch (e) {
  // Se netstat fallisce, continuiamo comunque
  console.log(`⚠ Impossibile verificare la porta ${PORT}, proseguo...`);
}

