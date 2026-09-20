import { TIAN_GAN, DI_ZHI, SHI_CHEN } from './constants';
import { getDayGanZhi } from './lunar';
import { getPillarYiJi, getChongShaByZhi } from './yiji';
import { jdnToGregorian } from '../utils/date';

// 黄黑道十二神（按各时辰地支从起例位顺布的顺序）
// 青龙、明堂、金匮、天德、玉堂、司命为黄道（吉）；其余为黑道（凶）
const HUANG_HEI: Array<{ shen: string; luck: '吉' | '凶' }> = [
  { shen: '青龙', luck: '吉' },
  { shen: '明堂', luck: '吉' },
  { shen: '天刑', luck: '凶' },
  { shen: '朱雀', luck: '凶' },
  { shen: '金匮', luck: '吉' },
  { shen: '天德', luck: '吉' },
  { shen: '白虎', luck: '凶' },
  { shen: '玉堂', luck: '吉' },
  { shen: '天牢', luck: '凶' },
  { shen: '玄武', luck: '凶' },
  { shen: '司命', luck: '吉' },
  { shen: '勾陈', luck: '凶' },
];

// 日支 -> 青龙起在何支（道藏《六十甲子本命元辰历》起黄黑道例）
// 子午青龙起在申，卯酉又从寅上亲，辰戌龙位位上子，巳亥午上存，
// 寅申居辰位，丑未戌上奔
const QING_LONG_START: Record<string, string> = {
  '子': '申', '午': '申',
  '卯': '寅', '酉': '寅',
  '辰': '子', '戌': '子',
  '巳': '午', '亥': '午',
  '寅': '辰', '申': '辰',
  '丑': '戌', '未': '戌',
};

export type Luck = '吉' | '凶';
export type ZiFlag = '' | '早子时' | '晚子时';
export type CompareState = 'match' | 'conflict' | 'neutral';

export interface ShiChenTag {
  text: string;
  // 与「当天宜忌」的比对：一致 / 冲突 / 无关
  state: CompareState;
}

export interface ShiChenSlot {
  /** 丑时、寅时…（早/晚子时同名，用 ziFlag 区分） */
  name: string;
  /** 展示时段，早子 00:00-01:00、晚子 23:00-24:00 */
  range: string;
  /** '' | '早子时' | '晚子时' */
  ziFlag: ZiFlag;
  /** 时柱干支（晚子时按次日日干起五鼠遁） */
  ganZhi: string;
  /** 黄黑道神煞名 */
  shen: string;
  luck: Luck;
  yi: ShiChenTag[];
  ji: ShiChenTag[];
  /** 冲的生肖，如「马」 */
  chongShengxiao: string;
  /** 煞方，如「南」 */
  sha: string;
  /** 该时柱归属哪一天（JDN） */
  belongJdn: number;
  belongDate: [number, number, number];
  /** 与当天宜忌的综合分，用于挑最吉/最凶 */
  score: number;
  /** 宜中与当日相冲的条数 */
  yiConflictCount: number;
  /** 忌中与当日相冲的条数 */
  jiConflictCount: number;
}

export interface DayShiChen {
  slots: ShiChenSlot[];
  best: ShiChenSlot;
  worst: ShiChenSlot;
  /** 当天日柱 */
  dayGanZhi: string;
  /** 次日日柱（晚子时归属） */
  nextDayGanZhi: string;
}

interface SlotDef {
  zhiIndex: number;
  name: string;
  range: string;
  ziFlag: ZiFlag;
  /** 时柱归属相对当天的天数偏移：早子+其他时辰为0，晚子为+1 */
  belongOffset: number;
}

// 一天 13 个时段：早子时（00:00-01:00）+ 丑…亥 + 晚子时（23:00-24:00）
// 丑时起的名称/时段直接用 SHI_CHEN 常量表（索引1..11），改表后全表跟着重算
function buildSlotDefs(): SlotDef[] {
  const defs: SlotDef[] = [
    { zhiIndex: 0, name: '子时', range: '00:00-01:00', ziFlag: '早子时', belongOffset: 0 },
  ];
  for (let i = 1; i < 12; i++) {
    const c = SHI_CHEN[i];
    defs.push({ zhiIndex: i, name: c.name, range: c.range, ziFlag: '', belongOffset: 0 });
  }
  defs.push({ zhiIndex: 0, name: '子时', range: '23:00-24:00', ziFlag: '晚子时', belongOffset: 1 });
  return defs;
}

// 五鼠遁：由日干与（归属日的）时支推时干
// 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
function hourGanZhi(dayGanZhi: string, hourZhiIndex: number): string {
  const dayGanIndex = TIAN_GAN.indexOf(dayGanZhi[0]);
  const hourGanStart = (dayGanIndex % 5) * 2; // 子时起干
  return TIAN_GAN[(hourGanStart + hourZhiIndex) % 10] + DI_ZHI[hourZhiIndex];
}

// 由日支、时支取黄黑道神煞
function huangHei(dayZhi: string, hourZhiIndex: number): { shen: string; luck: Luck } {
  const startZhi = QING_LONG_START[dayZhi];
  const startIndex = DI_ZHI.indexOf(startZhi);
  const idx = (hourZhiIndex - startIndex + 12) % 12;
  return HUANG_HEI[idx];
}

// 时辰宜忌条目与当天宜忌比对
function buildTags(items: string[], dayYi: string[], dayJi: string[], isYi: boolean): ShiChenTag[] {
  return items.map(text => {
    let state: CompareState = 'neutral';
    if (isYi) {
      if (dayJi.includes(text)) state = 'conflict'; // 时宜却日忌
      else if (dayYi.includes(text)) state = 'match';
    } else {
      if (dayYi.includes(text)) state = 'conflict'; // 时忌却日宜
      else if (dayJi.includes(text)) state = 'match';
    }
    return { text, state };
  });
}

/**
 * 计算某天全部时辰（13 行，含早/晚子时）。
 * @param dayYi 当天宜、@param dayJi 当天忌：用于时辰宜忌比对
 */
export function getDayShiChen(jdn: number, dayYi: string[] = [], dayJi: string[] = []): DayShiChen {
  const dayGanZhi = getDayGanZhi(jdn);
  const nextDayGanZhi = getDayGanZhi(jdn + 1);

  const slots: ShiChenSlot[] = buildSlotDefs().map(def => {
    const belongJdn = jdn + def.belongOffset;
    const belongGanZhi = getDayGanZhi(belongJdn);
    const ganZhi = hourGanZhi(belongGanZhi, def.zhiIndex);

    // 黄黑道以归属日的日支起青龙（晚子时归次日，故与次日的早子时同盘）
    const { shen, luck } = huangHei(belongGanZhi[1], def.zhiIndex);

    const pillar = getPillarYiJi(ganZhi);
    const yi = buildTags(pillar.yi, dayYi, dayJi, true);
    const ji = buildTags(pillar.ji, dayYi, dayJi, false);
    const cs = getChongShaByZhi(DI_ZHI[def.zhiIndex]);

    // 综合分：黄黑道打底 + 与当日宜忌一致/冲突
    let score = luck === '吉' ? 60 : 40;
    let yiConflictCount = 0;
    let jiConflictCount = 0;
    for (const t of yi) {
      if (t.state === 'match') score += 3;
      if (t.state === 'conflict') { score -= 8; yiConflictCount++; }
    }
    for (const t of ji) {
      if (t.state === 'match') score += 2;
      if (t.state === 'conflict') { score -= 8; jiConflictCount++; }
    }

    return {
      name: def.name,
      range: def.range,
      ziFlag: def.ziFlag,
      ganZhi,
      shen,
      luck,
      yi,
      ji,
      chongShengxiao: cs.chongShengxiao,
      sha: cs.sha,
      belongJdn,
      belongDate: jdnToGregorian(belongJdn),
      score,
      yiConflictCount,
      jiConflictCount,
    };
  });

  // 最吉：黄道中综合分最高；最凶：黑道中综合分最低
  const jiSlots = slots.filter(s => s.luck === '吉');
  const xiongSlots = slots.filter(s => s.luck === '凶');
  const best = [...jiSlots].sort((a, b) => b.score - a.score)[0]
    || [...slots].sort((a, b) => b.score - a.score)[0];
  const worst = [...xiongSlots].sort((a, b) => a.score - b.score)[0]
    || [...slots].sort((a, b) => a.score - b.score)[0];

  return { slots, best, worst, dayGanZhi, nextDayGanZhi };
}
