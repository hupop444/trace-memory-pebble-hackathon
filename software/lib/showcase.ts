import type { Trace } from './types';

export const ROADSHOW_MODE = true;

function atDaysAgo(days: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function oneYearAgoToday(hour: number, minute: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function aliveTrace(
  id: string,
  capturedAt: string,
  originalText: string,
  title: string,
  echo: string,
  hue: number,
  feelingTags: Trace['feelingTags'],
  relationTags: Trace['relationTags'],
  laterNotes?: Trace['laterNotes'],
): Trace {
  return {
    id,
    capturedAt,
    source: 'showcase',
    pressure: { durationMs: 680, peak: 0.61 },
    state: 'alive',
    originalText,
    title,
    echo,
    generatedBy: 'agent',
    visualSeed: { hue, warmth: 0.78, softness: 0.9 },
    feelingTags,
    relationTags,
    laterNotes,
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };
}

function unclaimedTrace(id: string, capturedAt: string, peak: number): Trace {
  return {
    id,
    capturedAt,
    source: 'showcase',
    pressure: { durationMs: 720, peak },
    state: 'unclaimed',
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };
}

/**
 * A repeatable presentation account, not a simulated capture control.
 * Refreshing restores the same three claim tasks and a coherent long-term garden.
 * Real hardware traces are preserved and continue to use the normal product path.
 */
export function createRoadshowTraces(existing: Trace[]): Trace[] {
  if (!ROADSHOW_MODE) return existing;

  const noteAt = atDaysAgo(2, 21, 10);
  const showcase: Trace[] = [
    unclaimedTrace('showcase-claim-now', minutesAgo(14), 0.66),
    unclaimedTrace('showcase-claim-earlier', minutesAgo(132), 0.54),
    unclaimedTrace('showcase-claim-morning', minutesAgo(286), 0.59),
    aliveTrace('showcase-month-01', atDaysAgo(1, 19, 12), '和朋友散步回来的路上，突然觉得今天很轻。', '晚风把今天放轻了', '原来普通的回家路，也能安静地接住一天。', 25, ['relaxed', 'warm'], ['friend'], [
      { id: 'showcase-note-01', text: '后来才知道，那天她也正好需要有人陪着走走。', createdAt: noteAt },
    ]),
    aliveTrace('showcase-month-02', atDaysAgo(3, 12, 36), '和同事吃到一家很好吃的小面馆，大家笑了很久。', '一碗面里的热闹', '那些没被计划的笑声，也在认真组成生活。', 356, ['fun', 'warm'], ['friend']),
    aliveTrace('showcase-month-03', atDaysAgo(5, 21, 5), '妈妈打电话来，只是提醒我明天会降温。', '一句降温提醒', '有些惦记不说想念，却一直在身边。', 338, ['warm'], ['family']),
    aliveTrace('showcase-month-04', atDaysAgo(7, 16, 42), '一个人在窗边喝咖啡，雨下得很慢。', '雨慢下来的下午', '独处不是空白，它也可以是一段完整的陪伴。', 215, ['relaxed'], ['alone']),
    aliveTrace('showcase-month-05', atDaysAgo(9, 18, 24), '终于把拖了很久的方案讲清楚了。', '终于说清楚的那一刻', '你没有急着庆祝，但这份松下来的感觉值得留下。', 74, ['relaxed'], ['small_win']),
    aliveTrace('showcase-month-06', atDaysAgo(12, 20, 16), '下雨时朋友把伞往我这边偏了一点。', '悄悄偏过来的伞', '被照顾有时没有声音，只是一点点靠近。', 12, ['warm', 'understood'], ['friend']),
    aliveTrace('showcase-month-07', atDaysAgo(15, 10, 8), '洗完床单，阳光把房间晒得很干净。', '晒过太阳的房间', '生活重新变得柔软，也许只需要一阵阳光。', 43, ['relaxed'], ['alone']),
    aliveTrace('showcase-month-08', atDaysAgo(18, 14, 33), '奶奶切了西瓜，还留了最甜的那一块给我。', '被留下的那一块甜', '那些习以为常的小动作，原来一直都是爱。', 326, ['warm'], ['family']),
    aliveTrace('showcase-month-09', atDaysAgo(21, 17, 48), '路过旧书店，找到一本小时候看过的书。', '旧书页里的重逢', '你遇见的不只是一册书，还有曾经认真读它的自己。', 262, ['warm', 'fun'], ['alone']),
    aliveTrace('showcase-month-10', atDaysAgo(24, 8, 52), '楼下的小猫第一次主动走过来蹭了蹭我。', '小猫今天靠近了一点', '信任发生得很轻，却足够让一个早晨变亮。', 145, ['fun', 'warm'], ['alone']),
    aliveTrace('showcase-month-11', atDaysAgo(26, 19, 34), '给自己做的晚饭居然很好吃。', '认真照顾自己的一餐', '普通的一餐，也可以是你递给自己的温柔。', 83, ['warm'], ['alone', 'small_win']),
    aliveTrace('showcase-month-12', atDaysAgo(27, 21, 16), '回家的公交上，月亮一直跟着车走。', '月亮陪我坐了一程', '赶路的晚上，也有一小段光愿意陪你慢下来。', 247, ['relaxed', 'warm'], ['alone']),
    // 原始问卷第13题中的匿名回答（仅取文字，不带任何身份字段）。
    aliveTrace('community-q13-01', atDaysAgo(2, 10, 18), '近期的工作规划和安排常在脑子已经安排好了 然后又忘了。', '脑子里排好的计划', '当时以为已经记住的安排，后来才发现，给它留下来很重要。', 42, ['understood', 'warm'], ['small_win']),
    aliveTrace('community-q13-02', atDaysAgo(4, 15, 8), '灵感闪现', '灵感闪现', '有些想法只停留几秒，留下它，后来真的能把事情往前推一步。', 330, ['fun', 'warm'], ['alone']),
    aliveTrace('community-q13-03', atDaysAgo(6, 9, 42), '重要的idea', '重要的 Idea', '一个念头先被留下，才有机会慢慢变成真正的事情。', 178, ['fun', 'warm'], ['small_win']),
    aliveTrace('community-q13-04', atDaysAgo(8, 18, 31), '每一次的记录会让大脑加深记忆、刻意记录会更有收获', '记录让记忆更深', '记录不只是保存，也是重新理解这一刻的开始。', 214, ['relaxed', 'understood'], ['small_win']),
    aliveTrace('community-q13-05', atDaysAgo(11, 20, 6), '手边有纸和笔反而会记下来，或者是一些有实际动作的行为', '手边有纸笔的时候', '有些记录不需要复杂工具，只需要一个顺手留下来的动作。', 292, ['relaxed'], ['alone']),
    aliveTrace('community-q13-06', atDaysAgo(14, 12, 12), '需要写长文，准备组织灵感和素材的时候', '写长文前的素材', '灵感和素材先被收好，后来组织起来时就不会从零开始。', 76, ['fun', 'warm'], ['small_win']),
    aliveTrace('community-q13-07', atDaysAgo(17, 16, 27), '非常难复刻的巧合/和朋友珍贵的再会或者告别', '一场难以复刻的再会', '不是每个瞬间都能重来，所以当时留下，后来才有地方回去。', 145, ['warm'], ['friend']),
    aliveTrace('community-q13-08', atDaysAgo(20, 7, 55), '写文章突然有了灵感，或者是突然想到工作任务的解决方案', '灵感突然来了', '好的想法不一定立刻成熟，但可以先给它一个不会消失的地方。', 342, ['fun', 'warm'], ['small_win']),
    aliveTrace('showcase-season-01', atDaysAgo(45, 18, 20), '傍晚第一次去江边游泳，水还是暖的。', '夏天刚开始的时候', '季节已经走远一点，但身体还记得那天的水温。', 191, ['relaxed', 'fun'], ['friend'], [
      { id: 'showcase-note-02', text: '后来又去了两次，那儿真的成了今年夏天的一部分。', createdAt: atDaysAgo(16, 22, 4) },
    ]),
    aliveTrace('showcase-year-01', oneYearAgoToday(17, 26), '去年今天，我们在草地上坐到天快黑。', '去年今日的晚霞', '一年过去了，那片晚霞仍然知道怎样找到你。', 29, ['warm', 'relaxed'], ['friend']),
  ];

  const realHardwareTraces = existing.filter((trace) => (trace.source === 'ble' || trace.source === 'websocket') && !trace.id.startsWith('showcase-'));
  return [...showcase, ...realHardwareTraces];
}
