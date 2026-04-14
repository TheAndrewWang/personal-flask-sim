<script lang="ts">
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Smartphone from '@lucide/svelte/icons/smartphone';

	import { onMount, onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import Palette from '@lucide/svelte/icons/palette';
	import X from '@lucide/svelte/icons/x';

	import { browser } from '$app/environment';
	import FluidSimulation from '$lib/FluidSimulation.svelte';

	const MAX_GRAVITY = 9.81;
	const MAX_GAS_GRAVITY = 5;


	type AppState = 'loading' | 'needs-permission' | 'ready' | 'denied' | 'not-supported';

	const fluidTypes = [
		{
			fluidColor: { r: 0.09, g: 0.4, b: 1.0 }
		},
		{
			fluidColor: { r: 0.0, g: 0.7, b: 0.8 }
		},
		{
			fluidColor: { r: 1.0, g: 0.4, b: 0.1 }
		},
		{
			fluidColor: { r: 0.5, g: 0.2, b: 0.9 }
		},
		{
			fluidColor: { r: 0.1, g: 0.6, b: 0.4 }
		},
		{
			fluidColor: { r: 0.9, g: 0.5, b: 0.6 }
		},
		{
			fluidColor: { r: 0.3, g: 0.7, b: 0.9 }
		},
		{
			fluidColor: { r: 0.9, g: 0.7, b: 0.2 }
		}
	];
	const gasTypes = [
		{
			gasColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.2 },
			foamColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.2 },
			colorDiffusionCoeff: 0.0008,
			foamReturnRate: 0.5
		},
		{
			gasColor: { r: 0.0, g: 0.7, b: 0.8, a: 0.2 },
			foamColor: { r: 0.0, g: 0.7, b: 0.8, a: 0.2 },
			colorDiffusionCoeff: 0.0012,
			foamReturnRate: 0.6
		},
		{
			gasColor: { r: 1.0, g: 0.4, b: 0.1, a: 0.2 },
			foamColor: { r: 1.0, g: 0.4, b: 0.1, a: 0.2 },
			colorDiffusionCoeff: 0.0004,
			foamReturnRate: 0.3
		},
		{
			gasColor: { r: 0.5, g: 0.2, b: 0.9, a: 0.2 },
			foamColor: { r: 0.5, g: 0.2, b: 0.9, a: 0.2 },
			colorDiffusionCoeff: 0.001,
			foamReturnRate: 0.7
		},
		{
			gasColor: { r: 0.1, g: 0.6, b: 0.4, a: 0.2 },
			foamColor: { r: 0.1, g: 0.6, b: 0.4, a: 0.2 },
			colorDiffusionCoeff: 0.0015,
			foamReturnRate: 0.4
		},
		{
			gasColor: { r: 0.9, g: 0.5, b: 0.6, a: 0.2 },
			foamColor: { r: 0.9, g: 0.5, b: 0.6, a: 0.2 },
			colorDiffusionCoeff: 0.0006,
			foamReturnRate: 0.8
		},
		{
			gasColor: { r: 0.3, g: 0.7, b: 0.9, a: 0.2 },
			foamColor: { r: 0.3, g: 0.7, b: 0.9, a: 0.2 },
			colorDiffusionCoeff: 0.0009,
			foamReturnRate: 0.5
		},
		{
			gasColor: { r: 0.9, g: 0.7, b: 0.2, a: 0.2 },
			foamColor: { r: 0.9, g: 0.7, b: 0.2, a: 0.2 },
			colorDiffusionCoeff: 0.0005,
			foamReturnRate: 0.2
		}
	]

	let currentFluidIndex = $state(0);
	let colorPanelOpen = $state(false);

	let gasColor = new Tween(gasTypes[0].gasColor, {
		duration: 500,
		easing: cubicOut
	});
	let foamColor = new Tween(gasTypes[0].foamColor, {
		duration: 500,
		easing: cubicOut
	});
	let colorDiffusionCoeff: number = $state(gasTypes[0].colorDiffusionCoeff);
	let foamReturnRate: number = $state(gasTypes[0].foamReturnRate);

	function toCSS(c: { r: number; g: number; b: number }) {
		return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
	}

	function selectColor(index: number) {
		if (index === currentFluidIndex) return;
		currentFluidIndex = index;
	}

	let angle: number | undefined = $state(0);
	let gravity: { x: number; y: number } = $state({ x: 0, y: -MAX_GRAVITY });
	let gasGravity: { x: number; y: number } = $state({ x: 0, y: MAX_GAS_GRAVITY });

	let appState: AppState = $state('loading');

	// Shake detection
	let lastShakeTime = 0;
	let lastAcceleration = { x: 0, y: 0, z: 0 };
	let shakeThreshold = 15;
	let shakeTimeThreshold = 600;

	const requestPermission = async () => {
		if (!browser) return;

		if (
			'DeviceOrientationEvent' in window &&
			typeof (DeviceOrientationEvent as any).requestPermission === 'function'
		) {
			// iOS 13+ permission request
			try {
				const orientationResponse = await (DeviceOrientationEvent as any).requestPermission();
				let motionResponse = 'granted';

				// Also request motion permission if available
				if (
					'DeviceMotionEvent' in window &&
					typeof (DeviceMotionEvent as any).requestPermission === 'function'
				) {
					motionResponse = await (DeviceMotionEvent as any).requestPermission();
				}

				if (orientationResponse === 'granted' && motionResponse === 'granted') {
					startListening();
					appState = 'ready';
				} else {
					appState = 'denied';
				}
			} catch (error) {
				console.error('Error requesting device motion/orientation permission:', error);
				appState = 'denied';
			}
		} else if ('DeviceOrientationEvent' in window) {
			startListening();
			appState = 'ready';
		} else {
			appState = 'not-supported';
		}
	};

	const startListening = () => {
		if (!browser) return;
		window.addEventListener('deviceorientation', onOrientationChange);
		window.addEventListener('devicemotion', onDeviceMotion);
	};

	const onDeviceMotion = (event: DeviceMotionEvent) => {
		if (!event.accelerationIncludingGravity) return;

		const acceleration = event.accelerationIncludingGravity;
		const x = acceleration.x || 0;
		const y = acceleration.y || 0;
		const z = acceleration.z || 0;

		// Calculate the magnitude of acceleration change
		const deltaX = Math.abs(x - lastAcceleration.x);
		const deltaY = Math.abs(y - lastAcceleration.y);
		const deltaZ = Math.abs(z - lastAcceleration.z);

		const totalDelta = deltaX + deltaY + deltaZ;
		const currentTime = Date.now();

		// Check if shake threshold is exceeded and enough time has passed
		if (totalDelta > shakeThreshold && currentTime - lastShakeTime > shakeTimeThreshold) {
			onShake();
			lastShakeTime = currentTime;
		}

		// Update last acceleration values
		lastAcceleration = { x, y, z };
	};

	const onOrientationChange = (event: DeviceOrientationEvent) => {
		if (event.beta !== null && event.gamma !== null) {
			const beta = event.beta;
			const gamma = event.gamma;

			const betaRad = beta * (Math.PI / 180);
			const gammaRad = gamma * (Math.PI / 180);

			const cosBeta = Math.cos(betaRad);
			const sinBeta = Math.sin(betaRad);
			const sinGamma = Math.sin(gammaRad);

			const gx = sinGamma * cosBeta;
			const gy = -sinBeta;

			gravity.x = MAX_GRAVITY * Math.max(-1, Math.min(1, gx));
			gravity.y = MAX_GRAVITY * Math.max(-1, Math.min(1, gy));
		}
	};

	onMount(async () => {
		if (!browser) return;

		if (!('DeviceOrientationEvent' in window)) {
			gravity = { x: 0, y: -MAX_GRAVITY };
			angle = 0;
			appState = 'not-supported';
			return;
		}

		if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
			appState = 'needs-permission';
		} else {
			startListening();
			appState = 'ready';
		}
	});

	onDestroy(() => {
		if (browser && window) {
			window.removeEventListener('deviceorientation', onOrientationChange);
			window.removeEventListener('devicemotion', onDeviceMotion);
		}
	});

	const onShake = () => {
		currentFluidIndex = (currentFluidIndex + 1) % fluidTypes.length;
	};
</script>

<div
	class="relative flex h-dvh overflow-hidden flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-950"
>
	{#if appState === 'loading'}
		<div class="text-center">
			<Loader2 class="mx-auto mb-4 h-12 w-12 animate-spin text-blue-400" />
			<h1 class="mb-2 text-2xl font-bold text-white">Fluid Simulation</h1>
			<p class="text-gray-300">Initializing...</p>
		</div>
	{:else if appState === 'needs-permission'}
		<div class="text-center">
			<Smartphone class="mx-auto mb-6 h-16 w-16 text-blue-400" />
			<h1 class="mb-4 text-2xl font-bold text-white">Motion Sensors Required</h1>
			<p class="mb-6 max-w-sm text-gray-300">
				This fluid simulation responds to your device's tilt and orientation. It also detects shake
				gestures to change fluid colors! Please grant permission to access motion sensors for the
				best experience.
			</p>
			<button
				onclick={requestPermission}
				class="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-none"
			>
				Enable Motion Sensors
			</button>
		</div>
	{:else if appState === 'denied'}
		<div class="text-center">
			<div class="mb-6 text-6xl">🚫</div>
			<h2 class="mb-4 text-xl font-semibold text-white">Permission Denied</h2>
			<p class="max-w-sm text-center text-gray-300">
				Motion sensor access was denied. You can still use the simulation, but it won't respond to
				device tilt. To enable this feature, please allow motion access in your browser settings.
			</p>
			<button
				onclick={requestPermission}
				class="mt-4 rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-500"
			>
				Try Again
			</button>
		</div>
	{:else}
		<FluidSimulation
			{gravity}
			{gasGravity}
			fluidColor={fluidTypes[currentFluidIndex].fluidColor}
			gasColor={gasColor.current}
			foamColor={foamColor.current}
			{colorDiffusionCoeff}
			{foamReturnRate}
		/>

		<!-- Color picker panel -->
		<div class="absolute top-5 right-5 z-20 flex flex-col items-center gap-2">
			<button
				onclick={() => (colorPanelOpen = !colorPanelOpen)}
				class="flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-sm transition-colors"
				style:background-color={colorPanelOpen ? 'rgba(255,255,255,0.2)' : toCSS(fluidTypes[currentFluidIndex].fluidColor)}
			>
				{#if colorPanelOpen}
					<X class="h-5 w-5 text-white" />
				{:else}
					<Palette class="h-5 w-5 text-white drop-shadow" />
				{/if}
			</button>

			{#if colorPanelOpen}
				<div class="flex flex-col gap-2 rounded-xl bg-black/40 p-2 backdrop-blur-md">
					{#each fluidTypes as fluid, i}
						<button
							onclick={() => selectColor(i)}
							aria-label="Select color {i + 1}"
							class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
							class:border-white={i === currentFluidIndex}
							class:border-transparent={i !== currentFluidIndex}
							style:background-color={toCSS(fluid.fluidColor)}
						></button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
