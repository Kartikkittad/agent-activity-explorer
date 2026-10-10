import { scrollTopToReveal, visibleRange } from './virtual';

describe('visibleRange', () => {
  it('renders the rows in view plus overscan', () => {
    // 400px viewport of 40px rows scrolled to row 100
    expect(visibleRange(4000, 400, 40, 1000, 5)).toEqual({ start: 95, end: 115 });
  });

  it('clamps at the start and end of the list', () => {
    expect(visibleRange(0, 400, 40, 1000, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRange(39_800, 400, 40, 1000, 5)).toEqual({ start: 990, end: 1000 });
  });

  it('handles partially visible rows', () => {
    expect(visibleRange(20, 100, 40, 1000, 0)).toEqual({ start: 0, end: 3 });
  });

  it('copes with an empty list or an unmeasured viewport', () => {
    expect(visibleRange(0, 400, 40, 0)).toEqual({ start: 0, end: 0 });
    expect(visibleRange(0, 0, 40, 100, 8)).toEqual({ start: 0, end: 8 });
  });
});

describe('scrollTopToReveal', () => {
  it('leaves scroll alone when the row is already visible', () => {
    expect(scrollTopToReveal(5, 40, 0, 400)).toBe(0);
  });

  it('scrolls up so the row is at the top', () => {
    expect(scrollTopToReveal(2, 40, 400, 400)).toBe(80);
  });

  it('scrolls down just enough to show the whole row', () => {
    expect(scrollTopToReveal(10, 40, 0, 400)).toBe(40);
  });
});
