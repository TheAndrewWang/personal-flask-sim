<script lang="ts">
	import { onMount } from 'svelte';
	import { Element } from '$lib/elements/Element';
	import carbonImage from '$lib/assets/carbon.png';

	import { setupFluidScene, FluidRenderer, FLUID_CELL } from '$lib/fluid';
	import type { FlipFluid } from '$lib/fluid';

	let {
		gravity = { x: 0, y: -9.81 },
		resolution = 70,
		fluidColor = { r: 0.09, g: 0.4, b: 1.0 },
		onclick
	}: {
		gravity?: { x: number; y: number };
		resolution?: number;
		angle?: number;
		fluidColor?: { r: number; g: number; b: number };
		onclick?: () => void;
	} = $props();

	let canvas: HTMLCanvasElement;
	let fluid: FlipFluid;
	let renderer: FluidRenderer;
	let solidElement: Element;
	let animationId: number;
	let isDragging = false;
	let fluidTouchingElement = false;

	let simHeight = 3.0;
	let simWidth = 4.0;

	const dt = 1.0 / 120.0;
	const flipRatio = 0.95;
	const numPressureIters = 60;
	const numParticleIters = 3;
	const overRelaxation = 1.7;
	const compensateDrift = true;
	const separateParticles = true;
	const showParticles = true;
	const showGrid = false;
	const damping = 0.99;
	const clickSpawnCount = 40;
	const clickSpawnRadius = 0.12;
	const clickSpawnSpeed = 0.0;

	// Particle count controls
	const relWaterWidth = 0.6; // Water width as fraction of tank (0.1 to 1.0)
	const relWaterHeight = 0.8; // Water height as fraction of tank (0.1 to 1.0)
	const elementWidth = 0.3;
	const elementHeight = 0.3;
	const minIntersectingFluidCells = 2; // Set for sensitivity of fluid-solid collisions

	function resizeCanvas() {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const devicePixelRatio = window.devicePixelRatio || 1;

		canvas.width = rect.width * devicePixelRatio;
		canvas.height = rect.height * devicePixelRatio;

		// Update simulation dimensions to maintain aspect ratio
		const cScale = canvas.height / simHeight;
		simWidth = canvas.width / cScale;

		if (renderer) {
			renderer.resize(canvas.width, canvas.height);
		}
	}

	function simulate() {
		if (!fluid || !solidElement) return;

		fluid.simulate(
			dt,
			gravity.x,
			gravity.y,
			flipRatio,
			numPressureIters,
			numParticleIters,
			overRelaxation,
			compensateDrift,
			separateParticles,
			damping
		);

		solidElement.step(dt, gravity.x, gravity.y, damping);

		const halfW = solidElement.getWidth() * 0.5;
		const halfH = solidElement.getHeight() * 0.5;
		solidElement.confineToBounds(halfW, simWidth - halfW, halfH, simHeight - halfH);

		fluidTouchingElement = isFluidTouchingElement();
	}

	function isFluidTouchingElement(): boolean {
		if (!fluid || !solidElement) return false;

		const requiredCells = Math.max(1, Math.floor(minIntersectingFluidCells));
		const halfW = solidElement.getWidth() * 0.5;
		const halfH = solidElement.getHeight() * 0.5;
		const minX = Math.max(0.0, solidElement.getX() - halfW);
		const maxX = Math.min(simWidth, solidElement.getX() + halfW);
		const minY = Math.max(0.0, solidElement.getY() - halfH);
		const maxY = Math.min(simHeight, solidElement.getY() + halfH);

		const x0 = Math.max(0, Math.floor(minX * fluid.fInvSpacing));
		const x1 = Math.min(fluid.fNumX - 1, Math.floor(maxX * fluid.fInvSpacing));
		const y0 = Math.max(0, Math.floor(minY * fluid.fInvSpacing));
		const y1 = Math.min(fluid.fNumY - 1, Math.floor(maxY * fluid.fInvSpacing));

		let fluidCellCount = 0;
		for (let xi = x0; xi <= x1; xi++) {
			for (let yi = y0; yi <= y1; yi++) {
				if (fluid.cellType[xi * fluid.fNumY + yi] === FLUID_CELL) {
					fluidCellCount++;
					if (fluidCellCount >= requiredCells) return true;
				}
			}
		}

		return false;
	}

	function render() {
		if (!fluid || !renderer || !solidElement) return;

		renderer.render(fluid, {
			showParticles,
			showGrid,
			simWidth,
			simHeight,
			element: {
				x: solidElement.getX(),
				y: solidElement.getY(),
				width: solidElement.getWidth(),
				height: solidElement.getHeight(),
				imageSrc: solidElement.getImageSrc(),
				isTouching: fluidTouchingElement
			}
		});
	}

	function update() {
		simulate();
		render();
		animationId = requestAnimationFrame(update);
	}

	function spawnAtPointer(event: PointerEvent) {
        if (!fluid || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;

        const x = nx * simWidth;
        const y = (1.0 - ny) * simHeight;

        fluid.spawnParticlesInRectangle(
            x,
            y,
            clickSpawnRadius,
            clickSpawnCount,
            clickSpawnSpeed
        );
    }

	onMount(() => {
		let id: number | null = null;

		const handlePointerDown = (event: PointerEvent) => {
			isDragging = true;
			canvas.setPointerCapture(event.pointerId);
			id = setInterval(() => {
				spawnAtPointer(event);
			}, 50);
		}
		const handlePointerMove = (event: PointerEvent) => {
			if (id !== null) {
				clearInterval(id);
			}
			if (!isDragging) return;
			spawnAtPointer(event);
			id = setInterval(() => {
				spawnAtPointer(event);
			}, 30);
		}
	    const handlePointerUp = (event: PointerEvent) => {
            isDragging = false;
            canvas.releasePointerCapture(event.pointerId);
			if (id !== null) {
				clearInterval(id);
			}
        };

        const handlePointerCancel = () => {
            isDragging = false;
			if (id !== null) {
				clearInterval(id);
			}
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointercancel', handlePointerCancel);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('pointercancel', handlePointerCancel);
        };
    });

	onMount(() => {
		resizeCanvas();

		// Initialize fluid simulation
		fluid = setupFluidScene(
			simWidth,
			simHeight,
			resolution,
			relWaterWidth,
			relWaterHeight,
			fluidColor
		);
		renderer = new FluidRenderer(canvas);
		solidElement = new Element(
			'block',
			1.0,
			carbonImage,
			elementWidth,
			elementHeight,
			simWidth * 0.5,
			simHeight * 0.75
		);

		// Initial color is already set via constructor, keep setter for consistency
		if (fluid) {
			fluid.setFluidColor(fluidColor);
		}

		// Handle window resize
		const handleResize = () => {
			resizeCanvas();
		};
		window.addEventListener('resize', handleResize);

		// Start animation loop
		update();

		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});

	// Watch for color changes and update fluid (supports live changes later)
	$effect(() => {
		if (fluid) {
			fluid.setFluidColor(fluidColor);
		}
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 z-10 h-full w-full"></canvas>
