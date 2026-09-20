import { describe, it, expect } from 'vitest';
import { getDayShiChen } from './shichen';
import { getDayGanZhi } from './lunar';
import { gregorianToJDN } from '../utils/date';
import { TIAN_GAN, DI_ZHI } from './constants';

// 60 甲子中的序号（-1 表示干支不配对）
function jiaZiIndex(gz: string): number {
  const g = TIAN_GAN.indexOf(gz[0]);
  const z = DI_ZHI.indexOf(gz[1]);
  for (let n = 0; n < 60; n++) {
    if (n % 10 === g && n % 12 === z) return n;
  }
  return -1;
}

// 2024-01-01 为甲子日（lunar.test.ts 中已固定该锚点）
const JDN_JIA_ZI = gregorianToJDN(2024, 1, 1);

describe('时辰总表', () => {
  it('一天应有13个时段：早子时 + 丑…亥 + 晚子时', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    expect(slots).toHaveLength(13);
    expect(slots[0].ziFlag).toBe('早子时');
    expect(slots[0].range).toBe('00:00-01:00');
    expect(slots[12].ziFlag).toBe('晚子时');
    expect(slots[12].range).toBe('23:00-24:00');
    // 中间依次为丑…亥，无早晚标记
    expect(slots[1].name).toBe('丑时');
    expect(slots[11].name).toBe('亥时');
    expect(slots.slice(1, 12).every(s => s.ziFlag === '')).toBe(true);
  });

  it('每个时辰都带宜忌、冲生肖、煞方', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    for (const s of slots) {
      expect(s.yi.length).toBeGreaterThan(0);
      expect(s.ji.length).toBeGreaterThan(0);
      expect(s.chongShengxiao).toBeTruthy();
      expect(['东', '南', '西', '北']).toContain(s.sha);
      expect(s.shen).toBeTruthy();
      expect(['吉', '凶']).toContain(s.luck);
      expect(s.ganZhi).toHaveLength(2);
    }
  });

  it('冲生肖与煞方随时支走（子时冲马煞南）', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    expect(slots[0].chongShengxiao).toBe('马');
    expect(slots[0].sha).toBe('南');
    // 午时冲鼠煞北
    const wu = slots.find(s => s.name === '午时')!;
    expect(wu.chongShengxiao).toBe('鼠');
    expect(wu.sha).toBe('北');
  });
});

describe('五鼠遁时柱', () => {
  it('甲日：早子甲子、丑乙丑…亥乙亥', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    expect(slots[0].ganZhi).toBe('甲子');
    expect(slots[1].ganZhi).toBe('乙丑');
    expect(slots[6].ganZhi).toBe('庚午'); // 午时
    expect(slots[11].ganZhi).toBe('乙亥');
  });

  it('晚子时按次日日干起遁：甲日晚子为丙子', () => {
    const { slots, nextDayGanZhi } = getDayShiChen(JDN_JIA_ZI);
    expect(nextDayGanZhi).toBe('乙丑'); // 乙庚丙作初 → 子为丙子
    expect(slots[12].ganZhi).toBe('丙子');
  });

  it('13个时柱在60甲子中首尾相接不断链', () => {
    for (const offset of [0, 1, 29, 30, 59]) {
      const { slots } = getDayShiChen(JDN_JIA_ZI + offset);
      const seq = slots.map(s => jiaZiIndex(s.ganZhi));
      for (let i = 1; i < seq.length; i++) {
        expect((seq[i - 1] + 1) % 60).toBe(seq[i]);
      }
    }
  });
});

describe('早晚子时归属', () => {
  it('早子时归当天，晚子时归次日', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    expect(slots[0].belongDate).toEqual([2024, 1, 1]);
    expect(slots[12].belongDate).toEqual([2024, 1, 2]);
    // 丑至亥都在当天
    expect(slots.slice(1, 12).every(s => s.belongJdn === JDN_JIA_ZI)).toBe(true);
  });

  it('当天晚子时与次日早子时：同柱、同神煞、同吉凶、同归属日', () => {
    const today = getDayShiChen(JDN_JIA_ZI);
    const tomorrow = getDayShiChen(JDN_JIA_ZI + 1);
    const wanZi = today.slots[12];
    const zaoZi = tomorrow.slots[0];
    expect(wanZi.ganZhi).toBe(zaoZi.ganZhi);
    expect(wanZi.shen).toBe(zaoZi.shen);
    expect(wanZi.luck).toBe(zaoZi.luck);
    expect(wanZi.belongJdn).toBe(zaoZi.belongJdn);
  });
});

describe('黄黑道十二神吉凶', () => {
  it('子日青龙起申：申青龙、酉明堂、戌天刑、子金匮、寅白虎、午司命', () => {
    const { slots } = getDayShiChen(JDN_JIA_ZI);
    const byName = (name: string, flag?: string) =>
      slots.find(s => s.name === name && s.ziFlag === (flag ?? ''))!;
    expect(byName('申时').shen).toBe('青龙');
    expect(byName('申时').luck).toBe('吉');
    expect(byName('酉时').shen).toBe('明堂');
    expect(byName('戌时').shen).toBe('天刑');
    expect(byName('戌时').luck).toBe('凶');
    expect(byName('亥时').shen).toBe('朱雀');
    expect(slots[0].shen).toBe('金匮'); // 早子
    expect(byName('丑时').shen).toBe('天德');
    expect(byName('寅时').shen).toBe('白虎');
    expect(byName('卯时').shen).toBe('玉堂');
    expect(byName('辰时').shen).toBe('天牢');
    expect(byName('巳时').shen).toBe('玄武');
    expect(byName('午时').shen).toBe('司命');
    expect(byName('未时').shen).toBe('勾陈');
  });

  it('同日干（甲）不同日支，吉凶表随日支变化而不是固定一张', () => {
    // 甲子日 vs 甲辰日：日干都是甲；子组青龙起申，辰组青龙起子
    const ziDay = getDayShiChen(JDN_JIA_ZI);
    const chenDay = getDayShiChen(JDN_JIA_ZI + 40); // 甲辰
    expect(getDayGanZhi(JDN_JIA_ZI + 40)).toBe('甲辰');
    expect(ziDay.slots[0].shen).toBe('金匮');
    expect(chenDay.slots[0].shen).toBe('青龙');
    // 至少有一个时辰吉凶相反
    const diff = ziDay.slots.filter((s, i) => s.luck !== chenDay.slots[i].luck);
    expect(diff.length).toBeGreaterThan(0);
  });

  it('逐日推进：日柱接得上，吉凶表也跟着换', () => {
    const d0 = getDayShiChen(JDN_JIA_ZI);
    const d1 = getDayShiChen(JDN_JIA_ZI + 1); // 乙丑，丑日青龙起戌
    expect(d0.dayGanZhi).toBe('甲子');
    expect(d1.dayGanZhi).toBe('乙丑');
    expect(d1.slots.find(s => s.name === '戌时')!.shen).toBe('青龙');
  });
});

describe('与当天宜忌比对', () => {
  it('时宜撞上日忌、时忌撞上日宜要标 conflict', () => {
    // 丁卯时宜「嫁娶」；丙寅时忌「祭祀」
    const { slots } = getDayShiChen(JDN_JIA_ZI, ['祭祀', '祈福'], ['嫁娶', '开市']);
    const mao = slots.find(s => s.name === '卯时')!;
    const jiaQu = mao.yi.find(t => t.text === '嫁娶')!;
    expect(jiaQu.state).toBe('conflict');
    const yin = slots.find(s => s.name === '寅时')!;
    const jiSi = yin.ji.find(t => t.text === '祭祀')!;
    expect(jiSi.state).toBe('conflict');
    // 一致项标 match：甲子时宜祭祀，当天也宜祭祀
    const jiSiYi = slots[0].yi.find(t => t.text === '祭祀')!;
    expect(jiSiYi.state).toBe('match');
    expect(yin.yiConflictCount).toBe(0);
  });
});

describe('最吉 / 最凶时辰', () => {
  it('最吉取黄道最高分，最凶取黑道最低分', () => {
    const { best, worst, slots } = getDayShiChen(JDN_JIA_ZI, ['祭祀'], []);
    expect(best.luck).toBe('吉');
    expect(worst.luck).toBe('凶');
    // 确为全表极值
    expect(best.score).toBe(Math.max(...slots.filter(s => s.luck === '吉').map(s => s.score)));
    expect(worst.score).toBe(Math.min(...slots.filter(s => s.luck === '凶').map(s => s.score)));
  });

  it('基础数据不变时，同一天重复计算结果一致（纯函数）', () => {
    const a = getDayShiChen(JDN_JIA_ZI, ['祭祀'], ['嫁娶']);
    const b = getDayShiChen(JDN_JIA_ZI, ['祭祀'], ['嫁娶']);
    expect(a.slots.map(s => s.ganZhi).join(',')).toBe(b.slots.map(s => s.ganZhi).join(','));
    expect(a.best.ganZhi).toBe(b.best.ganZhi);
    expect(a.worst.ganZhi).toBe(b.worst.ganZhi);
  });
});
