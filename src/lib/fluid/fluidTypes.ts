export type RGBColor = {
    r: number;
    g: number;
    b: number;
};

export type SolidCircle = {
    x: number;
    y: number;
    radius: number;
};

export function clamp(x: number, min: number, max: number): number {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

export function clamp01(x: number): number {
    return clamp(x, 0, 1);
}

export function sanitizeColor(color: RGBColor): RGBColor {
    return {
        r: clamp01(color.r),
        g: clamp01(color.g),
        b: clamp01(color.b)
    };
}

export function validatePositiveNumber(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive finite number`);
    }
}

export function validateNonNegativeNumber(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a non-negative finite number`);
    }
}

export function validateUnitInterval(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be between 0 and 1`);
    }
}