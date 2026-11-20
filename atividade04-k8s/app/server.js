// Grupo: Caio Abreu, Cassiano Abreu, Enzo Aquino, Gabriel Naoki e Wyllian Mariano
// Aplicação web simples: cadastra e lista tarefas no PostgreSQL.
// Logs em JSON no stdout (coletados pelo Promtail -> Loki).
// Traces enviados pelo OpenTelemetry (ver tracing.js) -> Tempo.

const express = require('express');
const { Pool } = require('pg');
const os = require('os');
const { trace } = require('@opentelemetry/api');

const PORT = 3000;
const app = express();
app.use(express.json());

// Configurações vêm do ConfigMap e do Secret no Kubernetes
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Log em JSON, incluindo o trace_id quando houver uma requisição ativa
function log(nivel, mensagem, extra = {}) {
  const span = trace.getActiveSpan();
  const ctx = span ? span.spanContext() : null;
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    level: nivel,
    msg: mensagem,
    pod: os.hostname(),
    trace_id: ctx ? ctx.traceId : undefined,
    ...extra,
  }));
}

// Página inicial: formulário + lista de tarefas + nome do pod que atendeu
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Tarefas - Atividade 04</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
    form { display: flex; gap: 8px; }
    input { flex: 1; padding: 8px; }
    button { padding: 8px 16px; }
    li { margin: 6px 0; }
    small { color: #666; }
  </style>
</head>
<body>
  <h1>Lista de tarefas</h1>
  <form id="form">
    <input id="titulo" placeholder="Nova tarefa" required maxlength="200">
    <button type="submit">Adicionar</button>
  </form>
  <ul id="lista"></ul>
  <p><small id="pod"></small></p>
  <script>
    async function carregar() {
      const res = await fetch('/api/tarefas');
      const tarefas = await res.json();
      const lista = document.getElementById('lista');
      lista.replaceChildren(...tarefas.map(t => {
        const li = document.createElement('li');
        li.textContent = t.titulo;
        return li;
      }));
      const info = await (await fetch('/api/info')).json();
      document.getElementById('pod').textContent = 'Atendido pelo pod: ' + info.pod;
    }
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value;
      await fetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo }),
      });
      document.getElementById('titulo').value = '';
      carregar();
    });
    carregar();
  </script>
</body>
</html>`);
});

// Nome do pod que está respondendo (usado para ver o balanceamento entre réplicas)
app.get('/api/info', (req, res) => {
  res.json({ pod: os.hostname() });
});

// Health check (usado pelo readinessProbe)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (erro) {
    log('error', 'Falha no health check do banco', { erro: erro.message });
    res.status(500).json({ status: 'erro no banco' });
  }
});

app.get('/api/tarefas', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, titulo FROM tarefas ORDER BY id DESC');
    log('info', 'Listagem de tarefas', { quantidade: resultado.rowCount });
    res.json(resultado.rows);
  } catch (erro) {
    log('error', 'Erro ao listar tarefas', { erro: erro.message });
    res.status(500).json({ erro: 'Erro ao listar tarefas' });
  }
});

app.post('/api/tarefas', async (req, res) => {
  const titulo = (req.body && req.body.titulo || '').trim();
  if (!titulo) {
    return res.status(400).json({ erro: 'O título é obrigatório' });
  }
  try {
    const resultado = await pool.query(
      'INSERT INTO tarefas (titulo) VALUES ($1) RETURNING id, titulo',
      [titulo]
    );
    log('info', 'Tarefa criada', { id: resultado.rows[0].id });
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    log('error', 'Erro ao criar tarefa', { erro: erro.message });
    res.status(500).json({ erro: 'Erro ao criar tarefa' });
  }
});

// Espera o banco ficar pronto antes de criar a tabela (o Postgres pode subir depois da app)
async function prepararBanco() {
  for (let tentativa = 1; tentativa <= 30; tentativa++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas (
          id SERIAL PRIMARY KEY,
          titulo VARCHAR(200) NOT NULL,
          criada_em TIMESTAMP DEFAULT NOW()
        )
      `);
      log('info', 'Banco de dados pronto');
      return;
    } catch (erro) {
      log('warn', `Banco indisponível, tentativa ${tentativa}/30`, { erro: erro.message });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  log('error', 'Não foi possível preparar o banco');
}

prepararBanco().finally(() => {
  app.listen(PORT, () => {
    log('info', `Aplicação rodando na porta ${PORT}`);
  });
});
