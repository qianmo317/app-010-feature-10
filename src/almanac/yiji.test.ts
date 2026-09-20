import { describe, it, expect } from 'vitest';
import { getDayYiJi, scoreDay, getPillarYiJi } from './yiji';

describe('宜忌计算', () => {
  it('应返回宜忌信息', () => {
    const yiJi = getDayYiJi(2024, 6, 15);
    expect(yiJi.yi).toBeInstanceOf(Array);
    expect(yiJi.ji).toBeInstanceOf(Array);
    expect(yiJi.yi.length).toBeGreaterThan(0);
    expect(yiJi.jianXing).toBeTruthy();
    expect(yiJi.zhiShen).toBeTruthy();
  });

  it('应正确计算冲煞', () => {
    const yiJi = getDayYiJi(2024, 6, 15);
    expect(yiJi.chong).toBeTruthy();
    expect(yiJi.sha).toBeTruthy();
    expect(yiJi.chongShengxiao).toBeTruthy();
  });

  it('日柱宜忌与干支宜忌共用同一套基础数据', () => {
    // getPillarYiJi 不带建星时只取天干+地支数据；同一干支结果应稳定
    const a = getPillarYiJi('甲子');
    expect(a.yi).toEqual(getPillarYiJi('甲子').yi);
    expect(a.ji).toEqual(getPillarYiJi('甲子').ji);
    expect(a.yi.length).toBeGreaterThan(0);
    expect(a.ji.length).toBeGreaterThan(0);
    // 带建星时应为建星数据与干支数据的并集
    const withJian = getPillarYiJi('甲子', '建');
    expect(withJian.yi.length).toBeGreaterThanOrEqual(a.yi.length);
    expect(withJian.ji.length).toBeGreaterThanOrEqual(a.ji.length);
    // 建日独有的宜（出行、上任…）应被并入
    expect(withJian.yi).toContain('出行');
  });
});

describe('择日评分', () => {
  it('应返回有效分数', () => {
    const score = scoreDay(2024, 6, 15, ['嫁娶']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('冲煞应降低分数', () => {
    const score1 = scoreDay(2024, 6, 15, ['嫁娶']);
    const score2 = scoreDay(2024, 6, 15, ['嫁娶'], ['鼠']);
    // 如果当天冲鼠，分数应该更低
    expect(score2).toBeLessThanOrEqual(score1);
  });
});
