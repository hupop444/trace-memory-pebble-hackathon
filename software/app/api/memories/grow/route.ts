import { Agent, run } from '@openai/agents';
import { z } from 'zod';

const GrowRequest = z.object({
  originalText: z.string().trim().min(1).max(160),
  capturedAt: z.string().datetime(),
});

const MemoryOutput = z.object({
  title: z.string().min(2).max(24),
  echo: z.string().min(6).max(60),
  visualSeed: z.object({
    hue: z.number().int().min(12).max(58),
    warmth: z.number().min(0).max(1),
    softness: z.number().min(0).max(1),
  }),
});

const memoryGardener = new Agent({
  name: 'Memory Gardener',
  instructions: `你是 TRACE 的 Memory Gardener，帮助用户让一段真实的小记忆获得温柔的表达。

规则：
1. 用户原文是唯一事实来源。不得补造人物、地点、动作、对话、天气、因果或情绪原因。
2. 不做心理诊断，不进行说教，不评价用户是否幸福、成长或自律。
3. 语气温和、克制、具体，避免鸡汤、宏大意义和过度煽情。
4. title 是 2–16 个中文字符的记忆标题；echo 是 12–36 个中文字符的轻柔回声。
5. echo 可以回应原文的感觉，但不能复述成另一个虚构故事。
6. visualSeed 只决定暖色记忆生命的外观：hue 取 12–58，warmth 与 softness 取 0–1。
7. 只返回规定的结构化结果。`,
  outputType: MemoryOutput,
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Agent is not configured.' }, { status: 503 });
  }

  const parsed = GrowRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid memory input.' }, { status: 400 });
  }

  const { originalText, capturedAt } = parsed.data;

  try {
    const result = await run(
      memoryGardener,
      `捕获时间：${capturedAt}\n用户原文：${originalText}`,
      { maxTurns: 2 },
    );

    if (!result.finalOutput) throw new Error('Agent returned no output.');
    return Response.json({ ...result.finalOutput, generatedBy: 'agent' as const });
  } catch {
    // The client deliberately owns the warm local fallback so this route never
    // invents a second, inconsistent response shape.
    return Response.json({ error: 'Memory Gardener is temporarily unavailable.' }, { status: 502 });
  }
}
