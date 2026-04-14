import type { FluidSceneOptions, SceneConfig } from './SceneConfig';
import type { RGBColor, SolidCircle } from './fluidTypes';

export type FluidPresetName =
    | 'calmTank'
    | 'rockChannel'
    | 'wideDamBreak'
    | 'foamStressTest'
    | 'lowGravity';

export interface FluidPreset {
    name: FluidPresetName;
    label: string;
    description: string;
    scene: Omit<FluidSceneOptions, 'simWidth' | 'simHeight'>;
    config: Partial<SceneConfig>;
}

const BLUE_WATER: RGBColor = { r: 0.06, g: 0.45, b: 0.9 };
const TURQUOISE_WATER: RGBColor = { r: 0.03, g: 0.62, b: 0.86 };
const FOAM: RGBColor = { r: 0.78, g: 0.92, b: 1.0 };

function makeRocks(...rocks: SolidCircle[]): SolidCircle[] {
    return rocks.map((rock) => ({ ...rock }));
}

export const FLUID_PRESETS: Record<FluidPresetName, FluidPreset> = {
    calmTank: {
        name: 'calmTank',
        label: 'Calm Tank',
        description: 'Balanced default scene for stable interactive playback.',
        scene: {
            resolution: 100,
            relWaterWidth: 0.55,
            relWaterHeight: 0.7,
            baseColor: BLUE_WATER,
            foamColor: FOAM,
            colorDiffusionCoeff: 0.008,
            foamReturnRate: 0.85,
            rocks: []
        },
        config: {
            gravity: -9.81,
            dt: 1.0 / 120.0,
            flipRatio: 0.88,
            numPressureIters: 90,
            numParticleIters: 2,
            overRelaxation: 1.85,
            damping: 0.999
        }
    },

    rockChannel: {
        name: 'rockChannel',
        label: 'Rock Channel',
        description: 'Adds staggered solid obstacles to test particle collision and wake behavior.',
        scene: {
            resolution: 115,
            relWaterWidth: 0.7,
            relWaterHeight: 0.75,
            baseColor: TURQUOISE_WATER,
            foamColor: FOAM,
            colorDiffusionCoeff: 0.015,
            foamReturnRate: 0.95,
            rocks: makeRocks(
                { x: 0.35, y: 0.32, radius: 0.08 },
                { x: 0.58, y: 0.48, radius: 0.07 },
                { x: 0.75, y: 0.26, radius: 0.06 }
            )
        },
        config: {
            gravity: -9.81,
            dt: 1.0 / 120.0,
            flipRatio: 0.92,
            numPressureIters: 120,
            numParticleIters: 3,
            overRelaxation: 1.9,
            damping: 0.998
        }
    },

    wideDamBreak: {
        name: 'wideDamBreak',
        label: 'Wide Dam Break',
        description: 'Creates a wider block of fluid for fast-moving horizontal wave fronts.',
        scene: {
            resolution: 120,
            relWaterWidth: 0.82,
            relWaterHeight: 0.72,
            baseColor: BLUE_WATER,
            foamColor: FOAM,
            colorDiffusionCoeff: 0.012,
            foamReturnRate: 1.1,
            rocks: []
        },
        config: {
            gravity: -10.5,
            dt: 1.0 / 144.0,
            flipRatio: 0.94,
            numPressureIters: 130,
            numParticleIters: 3,
            overRelaxation: 1.88,
            damping: 0.999
        }
    },

    foamStressTest: {
        name: 'foamStressTest',
        label: 'Foam Stress Test',
        description: 'Emphasizes foam generation and color relaxation for visual tuning.',
        scene: {
            resolution: 105,
            relWaterWidth: 0.65,
            relWaterHeight: 0.82,
            baseColor: { r: 0.02, g: 0.36, b: 0.78 },
            foamColor: { r: 0.9, g: 0.97, b: 1.0 },
            colorDiffusionCoeff: 0.03,
            foamReturnRate: 0.55,
            rocks: makeRocks(
                { x: 0.48, y: 0.38, radius: 0.1 },
                { x: 0.68, y: 0.58, radius: 0.075 }
            )
        },
        config: {
            gravity: -11.2,
            dt: 1.0 / 144.0,
            flipRatio: 0.96,
            numPressureIters: 140,
            numParticleIters: 4,
            overRelaxation: 1.92,
            damping: 0.997
        }
    },

    lowGravity: {
        name: 'lowGravity',
        label: 'Low Gravity',
        description: 'Slower, softer scene for checking numerical stability at low acceleration.',
        scene: {
            resolution: 95,
            relWaterWidth: 0.6,
            relWaterHeight: 0.65,
            baseColor: { r: 0.12, g: 0.5, b: 0.92 },
            foamColor: FOAM,
            colorDiffusionCoeff: 0.01,
            foamReturnRate: 0.7,
            rocks: makeRocks({ x: 0.5, y: 0.34, radius: 0.09 })
        },
        config: {
            gravity: -3.5,
            dt: 1.0 / 120.0,
            flipRatio: 0.82,
            numPressureIters: 80,
            numParticleIters: 2,
            overRelaxation: 1.75,
            damping: 0.9995
        }
    }
};

export function getFluidPreset(name: FluidPresetName): FluidPreset {
    const preset = FLUID_PRESETS[name];

    return {
        ...preset,
        scene: {
            ...preset.scene,
            baseColor: preset.scene.baseColor ? { ...preset.scene.baseColor } : undefined,
            foamColor: preset.scene.foamColor ? { ...preset.scene.foamColor } : undefined,
            rocks: preset.scene.rocks?.map((rock) => ({ ...rock })) || []
        },
        config: { ...preset.config }
    };
}

export function listFluidPresets(): FluidPreset[] {
    return Object.values(FLUID_PRESETS).map((preset) => getFluidPreset(preset.name));
}