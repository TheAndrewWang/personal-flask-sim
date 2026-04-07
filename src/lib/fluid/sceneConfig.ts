import { FlipFluid } from './FlipFluid';
import type { RGBColor, SolidCircle } from './fluidTypes';
import {
    sanitizeColor,
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

function validateSceneOptions(options: Required<Pick<
    FluidSceneOptions,
    'simWidth' | 'simHeight' | 'resolution' | 'relWaterWidth' | 'relWaterHeight' | 'colorDiffusionCoeff' | 'foamReturnRate' | 'rocks'
>>): void {
    validatePositiveNumber(options.simWidth, 'simWidth');
    validatePositiveNumber(options.simHeight, 'simHeight');
    validatePositiveNumber(options.resolution, 'resolution');
    validateUnitInterval(options.relWaterWidth, 'relWaterWidth');
    validateUnitInterval(options.relWaterHeight, 'relWaterHeight');
    validateUnitInterval(options.colorDiffusionCoeff, 'colorDiffusionCoeff');
    validateNonNegativeNumber(options.foamReturnRate, 'foamReturnRate');

    if (options.relWaterWidth === 0 || options.relWaterHeight === 0) {
        throw new Error('relWaterWidth and relWaterHeight must be greater than zero');
    }

    for (const rock of options.rocks) {
        validatePositiveNumber(rock.radius, 'rock.radius');

        if (!Number.isFinite(rock.x) || !Number.isFinite(rock.y)) {
            throw new Error('rock positions must be finite numbers');
        }
    }
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
    const options = {
        simWidth,
        simHeight,
        resolution,
        relWaterWidth,
        relWaterHeight,
        colorDiffusionCoeff,
        foamReturnRate,
        rocks
    };

    validateSceneOptions(options);

    const tankHeight = simHeight;
    const tankWidth = simWidth;
    const h = tankHeight / resolution;
    const density = 1000.0;

    const particleRadius = 0.3 * h;
    const dx = 2.0 * particleRadius;
    const dy = Math.sqrt(3.0) / 2.0 * dx;

    const usableWaterWidth = relWaterWidth * tankWidth - 2.0 * h - 2.0 * particleRadius;
    const usableWaterHeight = relWaterHeight * tankHeight - 2.0 * h - 2.0 * particleRadius;

    const numX = Math.max(1, Math.floor(usableWaterWidth / dx));
    const numY = Math.max(1, Math.floor(usableWaterHeight / dy));
    const maxParticles = numX * numY;

    const fluid = new FlipFluid(
        density,
        tankWidth,
        tankHeight,
        h,
        particleRadius,
        maxParticles,
        baseColor ? sanitizeColor(baseColor) : undefined,
        foamColor ? sanitizeColor(foamColor) : undefined,
        colorDiffusionCoeff,
        foamReturnRate
    );

    fluid.numParticles = maxParticles;

    const totalParticleWidth = (numX - 1) * dx;
    const totalParticleHeight = (numY - 1) * dy;

    const startX = (tankWidth - totalParticleWidth) / 2.0;
    const startY = (tankHeight - totalParticleHeight) / 2.0;

    let p = 0;
    for (let i = 0; i < numX; i++) {
        for (let j = 0; j < numY; j++) {
            fluid.particlePos[p++] = startX + dx * i + (j % 2 === 0 ? 0.0 : particleRadius);
            fluid.particlePos[p++] = startY + dy * j;
        }
    }

    const n = fluid.fNumY;
    for (let i = 0; i < fluid.fNumX; i++) {
        for (let j = 0; j < fluid.fNumY; j++) {
            const isWall = i === 0 || i === fluid.fNumX - 1 || j === 0;
            fluid.s[i * n + j] = isWall ? 0.0 : 1.0;
        }
    }

    for (const rock of rocks) {
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

export function setupFluidSceneFromOptions(options: FluidSceneOptions): FlipFluid {
    return setupFluidScene(
        options.simWidth,
        options.simHeight,
        options.resolution,
        options.relWaterWidth,
        options.relWaterHeight,
        options.baseColor,
        options.foamColor,
        options.colorDiffusionCoeff,
        options.foamReturnRate,
        options.rocks
    );
}