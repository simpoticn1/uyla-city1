export const E = { W: 1080, H: 1920, PX: 1 };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = { inOut: (x) => ((x = clamp(x)) < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), out: (x) => 1 - (1 - clamp(x)) ** 3 };
