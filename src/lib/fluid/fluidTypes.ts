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

export type Bounds2D = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export function clamp(x: number, min: number, max: number): number {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

export function clamp01(x: number): number {
    return clamp(x, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * clamp01(t);
}

export function sanitizeColor(color: RGBColor): RGBColor {
    return {
        r: clamp01(color.r),
        g: clamp01(color.g),
        b: clamp01(color.b)
    };
}

export function mixColors(a: RGBColor, b: RGBColor, t: number): RGBColor {
    const safeT = clamp01(t);

    return {
        r: lerp(a.r, b.r, safeT),
        g: lerp(a.g, b.g, safeT),
        b: lerp(a.b, b.b, safeT)
    };
}

export function colorToArray(color: RGBColor): [number, number, number] {
    const safe = sanitizeColor(color);
    return [safe.r, safe.g, safe.b];
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

export function validateBounds(bounds: Bounds2D, name = 'bounds'): void {
    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) {
        throw new Error(`${name}.minX and ${name}.maxX must be finite numbers`);
    }

    if (!Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) {
        throw new Error(`${name}.minY and ${name}.maxY must be finite numbers`);
    }

    if (bounds.maxX <= bounds.minX) {
        throw new Error(`${name}.maxX must be greater than ${name}.minX`);
    }

    if (bounds.maxY <= bounds.minY) {
        throw new Error(`${name}.maxY must be greater than ${name}.minY`);
    }
}

export function circleIntersectsBounds(circle: SolidCircle, bounds: Bounds2D): boolean {
    const closestX = clamp(circle.x, bounds.minX, bounds.maxX);
    const closestY = clamp(circle.y, bounds.minY, bounds.maxY);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;

    return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function circleContainsPoint(circle: SolidCircle, x: number, y: number, padding = 0): boolean {
    const dx = x - circle.x;
    const dy = y - circle.y;
    const radius = circle.radius + padding;

    return dx * dx + dy * dy <= radius * radius;
}