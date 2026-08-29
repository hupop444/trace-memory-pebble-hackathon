export async function GET() {
  return Response.json({
    ok: true,
    service: 'trace-memory-gardener',
    agentConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
}
