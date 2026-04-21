import { FlipFluid } from './FlipFluid';
import type { RGBColor, SolidCircle } from './fluidTypes';
import {
    circleContainsPoint,
    circleIntersectsBounds,
    sanitizeColor,
    scaleCircle,
    validateNonNegativeNumber,
    validatePositiveNumber,
    validateUnitInterval
} from './fluidTypes';

export interface SceneConfig {
    gravity: number;
    dt: number;
    flipRatio: number;
    numPressureIters: number;
    numParticleIters: number;
    overRelaxation: number;
    compensateDrift: boolean;
    separateParticles: boolean;
    showParticles: boolean;
    showGrid: boolean;
    damping: number;
}

export interface FluidSceneOptions {
    simWidth: number;
    simHeight: number;
    resolution?: number;
    relWaterWidth?: number;
    relWaterHeight?: number;
    baseColor?: RGBColor;
    foamColor?: RGBColor;
    colorDiffusionCoeff?: number;
    foamReturnRate?: number;
    rocks?: SolidCircle[];
    rocksAreRelative?: boolean;
    particleJitter?: number;
}

export interface NormalizedFluidSceneOptions {
    simWidth: number;
    simHeight: number;
    resolution: number;
    relWaterWidth: number;
    relWaterHeight: number;
    baseColor?: RGBColor;
    foamColor?: RGBColor;
    colorDiffusionCoeff: number;
    foamReturnRate: number;
    rocks: SolidCircle[];
    rocksAreRelative: boolean;
    particleJitter: number;
}

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
    gravity: -9.81,
    dt: 1.0 / 120.0,
    flipRatio: 0.9,
    numPressureIters: 100,
    numParticleIters: 2,
    overRelaxation: 1.9,
    compensateDrift: true,
    separateParticles: true,
    showParticles: true,
    showGrid: false,
    damping: 1.0
};

function validateSceneConfig(config: SceneConfig): void {
    if (!Number.isFinite(config.gravity)) {
        throw new Error('gravity must be a finite number');
    }

    validatePositiveNumber(config.dt, 'dt');
    validateUnitInterval(config.flipRatio, 'flipRatio');
    validatePositiveNumber(config.numPressureIters, 'numPressureIters');
    validateNonNegativeNumber(config.numParticleIters, 'numParticleIters');
    validatePositiveNumber(config.overRelaxation, 'overRelaxation');
    validateUnitInterval(config.damping, 'damping');
}

function validateSceneOptions(options: NormalizedFluidSceneOptions): void {
    validatePositiveNumber(options.simWidth, 'simWidth');
    validatePositiveNumber(options.simHeight, 'simHeight');
    validatePositiveNumber(options.resolution, 'resolution');
    validateUnitInterval(options.relWaterWidth, 'relWaterWidth');
    validateUnitInterval(options.relWaterHeight, 'relWaterHeight');
    validateUnitInterval(options.colorDiffusionCoeff, 'colorDiffusionCoeff');
    validateNonNegativeNumber(options.foamReturnRate, 'foamReturnRate');
    validateUnitInterval(options.particleJitter, 'particleJitter');

    if (options.relWaterWidth === 0 || options.relWaterHeight === 0) {
        throw new Error('relWaterWidth and relWaterHeight must be greater than zero');
    }

    const sceneBounds = {
        minX: 0,
        maxX: options.simWidth,
        minY: 0,
        maxY: options.simHeight
    };

    for (const rock of options.rocks) {
        validatePositiveNumber(rock.radius, 'rock.radius');

        if (!Number.isFinite(rock.x) || !Number.isFinite(rock.y)) {
            throw new Error('rock positions must be finite numbers');
        }

        if (!circleIntersectsBounds(rock, sceneBounds)) {
            throw new Error('rock must intersect the simulation bounds');
        }
    }
}

export function normalizeSceneConfig(config: Partial<SceneConfig> = {}): SceneConfig {
    const normalized: SceneConfig = {
        ...DEFAULT_SCENE_CONFIG,
        ...config
    };

    normalized.numPressureIters = Math.max(1, Math.floor(normalized.numPressureIters));
    normalized.numParticleIters = Math.max(0, Math.floor(normalized.numParticleIters));

    validateSceneConfig(normalized);

    return normalized;
}

export function normalizeFluidSceneOptions(options: FluidSceneOptions): NormalizedFluidSceneOptions {
    const normalized: NormalizedFluidSceneOptions = {
        simWidth: options.simWidth,
        simHeight: options.simHeight,
        resolution: options.resolution ?? 100,
        relWaterWidth: options.relWaterWidth ?? 0.6,
        relWaterHeight: options.relWaterHeight ?? 0.8,
        baseColor: options.baseColor ? sanitizeColor(options.baseColor) : undefined,
        foamColor: options.foamColor ? sanitizeColor(options.foamColor) : undefined,
        colorDiffusionCoeff: options.colorDiffusionCoeff ?? 0.01,
        foamReturnRate: options.foamReturnRate ?? 1.0,
        rocks: options.rocks?.map((rock) => ({ ...rock })) || [],
        rocksAreRelative: options.rocksAreRelative ?? false,
        particleJitter: options.particleJitter ?? 0
    };

    if (normalized.rocksAreRelative) {
        normalized.rocks = normalized.rocks.map((rock) =>
            scaleCircle(rock, normalized.simWidth, normalized.simHeight)
        );
        normalized.rocksAreRelative = false;
    }

    validateSceneOptions(normalized);

    return normalized;
}

function isParticleInsideAnyRock(x: number, y: number, radius: number, rocks: SolidCircle[]): boolean {
    for (const rock of rocks) {
        if (circleContainsPoint(rock, x, y, radius * 1.25)) {
            return true;
        }
    }

    return false;
}

function deterministicJitter(i: number, j: number, amount: number): { x: number; y: number } {
    if (amount <= 0) {
        return { x: 0, y: 0 };
    }

    const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453123;
    const frac = seed - Math.floor(seed);

    const seed2 = Math.sin(i * 269.5 + j * 183.3) * 24634.6345;
    const frac2 = seed2 - Math.floor(seed2);

    return {
        x: (frac - 0.5) * amount,
        y: (frac2 - 0.5) * amount
    };
}

export function setupFluidScene(
    simWidth: number,
    simHeight: number,
    resolution = 100,
    relWaterWidth = 0.6,
    relWaterHeight = 0.8,
    baseColor?: RGBColor,
    foamColor?: RGBColor,
    colorDiffusionCoeff = 0.01,
    foamReturnRate = 1.0,
    rocks: SolidCircle[] = []
): FlipFluid {
    return setupFluidSceneFromOptions({
        simWidth,
        simHeight,
        resolution,
        relWaterWidth,
        relWaterHeight,
        baseColor,
        foamColor,
        colorDiffusionCoeff,
        foamReturnRate,
        rocks
    });
}

export function setupFluidSceneFromOptions(options: FluidSceneOptions): FlipFluid {
    const normalized = normalizeFluidSceneOptions(options);

    const tankHeight = normalized.simHeight;
    const tankWidth = normalized.simWidth;
    const h = tankHeight / normalized.resolution;
    const density = 1000.0;

    const particleRadius = 0.3 * h;
    const dx = 2.0 * particleRadius;
    const dy = Math.sqrt(3.0) / 2.0 * dx;

    const usableWaterWidth = normalized.relWaterWidth * tankWidth - 2.0 * h - 2.0 * particleRadius;
    const usableWaterHeight = normalized.relWaterHeight * tankHeight - 2.0 * h - 2.0 * particleRadius;

    const numX = Math.max(1, Math.floor(usableWaterWidth / dx));
    const numY = Math.max(1, Math.floor(usableWaterHeight / dy));

    const candidateParticleCount = numX * numY;

    const fluid = new FlipFluid(
        density,
        tankWidth,
        tankHeight,
        h,
        particleRadius,
        candidateParticleCount,
        normalized.baseColor,
        normalized.foamColor,
        normalized.colorDiffusionCoeff,
        normalized.foamReturnRate
    );

    const totalParticleWidth = (numX - 1) * dx;
    const totalParticleHeight = (numY - 1) * dy;

    const startX = (tankWidth - totalParticleWidth) / 2.0;
    const startY = (tankHeight - totalParticleHeight) / 2.0;

    let particleIndex = 0;

    for (let i = 0; i < numX; i++) {
        for (let j = 0; j < numY; j++) {
            const jitter = deterministicJitter(i, j, normalized.particleJitter * particleRadius);
            const x = startX + dx * i + (j % 2 === 0 ? 0.0 : particleRadius) + jitter.x;
            const y = startY + dy * j + jitter.y;

            if (isParticleInsideAnyRock(x, y, particleRadius, normalized.rocks)) {
                continue;
            }

            fluid.particlePos[2 * particleIndex] = x;
            fluid.particlePos[2 * particleIndex + 1] = y;
            particleIndex++;
        }
    }

    fluid.numParticles = particleIndex;

    const n = fluid.fNumY;

    for (let i = 0; i < fluid.fNumX; i++) {
        for (let j = 0; j < fluid.fNumY; j++) {
            const isWall = i === 0 || i === fluid.fNumX - 1 || j === 0;
            fluid.s[i * n + j] = isWall ? 0.0 : 1.0;
        }
    }

    for (const rock of normalized.rocks) {
        fluid.addSolidCircle(rock.x, rock.y, rock.radius);
    }

    for (let i = 0; i < fluid.fNumX * fluid.fNumY; i++) {
        if (fluid.s[i] === 0.0) {
            fluid.gridVelX[i] = 0.0;
            fluid.gridVelY[i] = 0.0;
        }
    }

    return fluid;
}