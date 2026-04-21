import type { FlipFluid } from './FlipFluid';
import type { SceneConfig } from './SceneConfig';

export interface SimulationRunnerOptions {
    maxFrameDelta: number;
    maxSubSteps: number;
    timeScale: number;
}

export interface SimulationStepResult {
    simulatedSteps: number;
    consumedTime: number;
    remainingAccumulator: number;
    droppedTime: number;
}

const DEFAULT_RUNNER_OPTIONS: SimulationRunnerOptions = {
    maxFrameDelta: 0.1,
    maxSubSteps: 8,
    timeScale: 1.0
};

export class FluidSimulationRunner {
    private accumulator = 0;
    private lastTimestamp = 0;
    private paused = false;
    private options: SimulationRunnerOptions;

    constructor(options: Partial<SimulationRunnerOptions> = {}) {
        this.options = {
            ...DEFAULT_RUNNER_OPTIONS,
            ...options
        };

        this.sanitizeOptions();
    }

    reset(timestamp = 0): void {
        this.accumulator = 0;
        this.lastTimestamp = timestamp;
    }

    clearAccumulator(): void {
        this.accumulator = 0;
    }

    getAccumulator(): number {
        return this.accumulator;
    }

    setPaused(paused: boolean): void {
        this.paused = paused;
    }

    togglePaused(): boolean {
        this.paused = !this.paused;
        return this.paused;
    }

    isPaused(): boolean {
        return this.paused;
    }

    setTimeScale(timeScale: number): void {
        this.options.timeScale = timeScale;
        this.sanitizeOptions();
    }

    getTimeScale(): number {
        return this.options.timeScale;
    }

    setOptions(options: Partial<SimulationRunnerOptions>): void {
        this.options = {
            ...this.options,
            ...options
        };

        this.sanitizeOptions();
    }

    getOptions(): SimulationRunnerOptions {
        return { ...this.options };
    }

    private sanitizeOptions(): void {
        this.options.maxFrameDelta = Math.max(0.001, this.options.maxFrameDelta);
        this.options.maxSubSteps = Math.max(1, Math.floor(this.options.maxSubSteps));
        this.options.timeScale = Math.max(0, this.options.timeScale);
    }

    stepFrame(
        timestampSeconds: number,
        fluid: FlipFluid,
        config: SceneConfig,
        gravityX = 0
    ): SimulationStepResult {
        if (this.paused) {
            this.lastTimestamp = timestampSeconds;

            return {
                simulatedSteps: 0,
                consumedTime: 0,
                remainingAccumulator: this.accumulator,
                droppedTime: 0
            };
        }

        if (this.lastTimestamp === 0) {
            this.lastTimestamp = timestampSeconds;
        }

        const rawFrameDelta = timestampSeconds - this.lastTimestamp;
        this.lastTimestamp = timestampSeconds;

        const clampedFrameDelta = Math.min(
            Math.max(rawFrameDelta, 0),
            this.options.maxFrameDelta
        );

        const scaledFrameDelta = clampedFrameDelta * this.options.timeScale;
        this.accumulator += scaledFrameDelta;

        let simulatedSteps = 0;
        let consumedTime = 0;
        let droppedTime = 0;

        while (this.accumulator >= config.dt && simulatedSteps < this.options.maxSubSteps) {
            this.simulateStep(fluid, config, gravityX);

            this.accumulator -= config.dt;
            consumedTime += config.dt;
            simulatedSteps++;
        }

        if (simulatedSteps === this.options.maxSubSteps && this.accumulator >= config.dt) {
            droppedTime = this.accumulator - config.dt * 0.5;
            this.accumulator = config.dt * 0.5;
        }

        return {
            simulatedSteps,
            consumedTime,
            remainingAccumulator: this.accumulator,
            droppedTime: Math.max(0, droppedTime)
        };
    }

    runSingleStep(
        fluid: FlipFluid,
        config: SceneConfig,
        gravityX = 0
    ): SimulationStepResult {
        this.simulateStep(fluid, config, gravityX);

        return {
            simulatedSteps: 1,
            consumedTime: config.dt,
            remainingAccumulator: this.accumulator,
            droppedTime: 0
        };
    }

    runSteps(
        count: number,
        fluid: FlipFluid,
        config: SceneConfig,
        gravityX = 0
    ): SimulationStepResult {
        const safeCount = Math.max(0, Math.floor(count));

        for (let i = 0; i < safeCount; i++) {
            this.simulateStep(fluid, config, gravityX);
        }

        return {
            simulatedSteps: safeCount,
            consumedTime: safeCount * config.dt,
            remainingAccumulator: this.accumulator,
            droppedTime: 0
        };
    }

    private simulateStep(fluid: FlipFluid, config: SceneConfig, gravityX: number): void {
        fluid.simulate(
            config.dt,
            gravityX,
            config.gravity,
            config.flipRatio,
            config.numPressureIters,
            config.numParticleIters,
            config.overRelaxation,
            config.compensateDrift,
            config.separateParticles,
            config.damping
        );
    }
}