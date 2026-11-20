// Grupo: Caio Abreu, Cassiano Abreu, Enzo Aquino, Gabriel Naoki e Wyllian Mariano
// Inicializa o OpenTelemetry antes da aplicação (carregado com --require no npm start).
// Envia os traces via OTLP HTTP para o Tempo.

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'tarefas-app',
  traceExporter: new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
