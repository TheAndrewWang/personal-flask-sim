import type { FlipFluid } from './FlipFluid';

const pointVertexShader = `
	attribute vec2 attrPosition;
	attribute vec3 attrColor;
	uniform vec2 domainSize;
	uniform float pointSize;
	uniform float drawDisk;
	varying vec3 fragColor;
	varying float fragDrawDisk;
	void main() {
		vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
		gl_Position = vec4(attrPosition * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
		gl_PointSize = pointSize;
		fragColor = attrColor;
		fragDrawDisk = drawDisk;
	}
`;

const pointFragmentShader = `
	precision mediump float;
	varying vec3 fragColor;
	varying float fragDrawDisk;
	void main() {
		if (fragDrawDisk == 1.0) {
			float r2 = dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5);
			if (r2 > 0.25) discard;
			float alpha = 1.0 - smoothstep(0.15, 0.25, r2);
			gl_FragColor = vec4(fragColor, alpha * 0.8);
		} else {
			gl_FragColor = vec4(fragColor, 1.0);
		}
	}
`;

const meshVertexShader = `
	attribute vec2 attrPosition;
	uniform vec2 domainSize;
	uniform vec3 color;
	uniform vec2 translation;
	uniform float scale;
	varying vec3 fragColor;
	void main() {
		vec2 v = translation + attrPosition * scale;
		vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
		gl_Position = vec4(v * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
		fragColor = color;
	}
`;

const meshFragmentShader = `
	precision mediump float;
	varying vec3 fragColor;
	void main() {
		gl_FragColor = vec4(fragColor, 1.0);
	}
`;

const accumVertexShader = `
	attribute vec2 attrPosition;
	attribute vec3 attrColor;
	uniform vec2 domainSize;
	uniform float radiusPx;
	varying vec3 vColor;
	void main() {
		vec4 st = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
		gl_Position = vec4(attrPosition * st.xy + st.zw, 0.0, 1.0);
		gl_PointSize = radiusPx * 2.0;
		vColor = attrColor;
	}
`;

const accumFragmentShader = `
	precision mediump float;
	varying vec3 vColor;
	uniform float accumScale;
	void main() {
		vec2 coord = gl_PointCoord - 0.5;
		float dist = length(coord) * 2.0;
		if (dist > 1.0) discard;
		float influence = 1.0 - dist;
		float weight = influence * influence * accumScale;
		gl_FragColor = vec4(vColor * weight, weight);
	}
`;

const compositeVertexShader = `
	attribute vec2 attrPosition;
	varying vec2 vTexCoord;
	void main() {
		gl_Position = vec4(attrPosition, 0.0, 1.0);
		vTexCoord = (attrPosition + 1.0) * 0.5;
	}
`;

const compositeFragmentShader = `
	precision mediump float;
	varying vec2 vTexCoord;
	uniform sampler2D accumTex;
	uniform float threshold;
	void main() {
		vec4 accum = texture2D(accumTex, vTexCoord);
		if (accum.a < threshold) discard;
		vec3 color = accum.rgb / max(accum.a, 0.0001);
		gl_FragColor = vec4(color, 1.0);
	}
`;

export interface RenderConfig {
    showParticles: boolean;
    showGrid: boolean;
    showFluid: boolean;
    simWidth: number;
    simHeight: number;
}

export interface FluidSurfaceConfig {
    influenceRadius: number;
    accumScale: number;
    threshold: number;
}

export class FluidRenderer {
    private gl: WebGLRenderingContext;
    private pointShader: WebGLProgram;
    private meshShader: WebGLProgram;
    private accumShader: WebGLProgram;
    private compositeShader: WebGLProgram;
    private pointVertexBuffer: WebGLBuffer;
    private pointColorBuffer: WebGLBuffer;
    private gridVertBuffer: WebGLBuffer;
    private gridColorBuffer: WebGLBuffer;
    private quadBuffer: WebGLBuffer;
    private gridVertBufferInitialized = false;

    private accumFramebuffer: WebGLFramebuffer | null = null;
    private accumTexture: WebGLTexture | null = null;
    private accumWidth = 0;
    private accumHeight = 0;

    private influenceRadius = 0.1;
    private accumScale = 0.35;
    private threshold = 0.4;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false
        });

        if (!gl) {
            throw new Error('WebGL not supported');
        }

        this.gl = gl;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.pointShader = this.createShader(pointVertexShader, pointFragmentShader);
        this.meshShader = this.createShader(meshVertexShader, meshFragmentShader);
        this.accumShader = this.createShader(accumVertexShader, accumFragmentShader);
        this.compositeShader = this.createShader(compositeVertexShader, compositeFragmentShader);

        this.pointVertexBuffer = this.createBuffer();
        this.pointColorBuffer = this.createBuffer();
        this.gridVertBuffer = this.createBuffer();
        this.gridColorBuffer = this.createBuffer();

        this.quadBuffer = this.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1, 1, -1, -1, 1,
                -1, 1, 1, -1, 1, 1
            ]),
            gl.STATIC_DRAW
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    private createShader(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;

        const vsShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vsShader) throw new Error('Failed to create vertex shader');

        gl.shaderSource(vsShader, vsSource);
        gl.compileShader(vsShader);

        if (!gl.getShaderParameter(vsShader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(vsShader) || 'Unknown vertex shader error';
            gl.deleteShader(vsShader);
            throw new Error(`Vertex shader compilation failed: ${info}`);
        }

        const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fsShader) {
            gl.deleteShader(vsShader);
            throw new Error('Failed to create fragment shader');
        }

        gl.shaderSource(fsShader, fsSource);
        gl.compileShader(fsShader);

        if (!gl.getShaderParameter(fsShader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(fsShader) || 'Unknown fragment shader error';
            gl.deleteShader(vsShader);
            gl.deleteShader(fsShader);
            throw new Error(`Fragment shader compilation failed: ${info}`);
        }

        const shader = gl.createProgram();
        if (!shader) {
            gl.deleteShader(vsShader);
            gl.deleteShader(fsShader);
            throw new Error('Failed to create shader program');
        }

        gl.attachShader(shader, vsShader);
        gl.attachShader(shader, fsShader);
        gl.linkProgram(shader);

        gl.deleteShader(vsShader);
        gl.deleteShader(fsShader);

        if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(shader) || 'Unknown shader link error';
            gl.deleteProgram(shader);
            throw new Error(`Shader program linking failed: ${info}`);
        }

        return shader;
    }

    private createBuffer(): WebGLBuffer {
        const buffer = this.gl.createBuffer();
        if (!buffer) throw new Error('Failed to create buffer');
        return buffer;
    }

    setSurfaceConfig(config: Partial<FluidSurfaceConfig>): void {
        if (config.influenceRadius !== undefined) {
            this.influenceRadius = Math.max(0.001, config.influenceRadius);
        }

        if (config.accumScale !== undefined) {
            this.accumScale = Math.max(0.001, config.accumScale);
        }

        if (config.threshold !== undefined) {
            this.threshold = Math.max(0.001, config.threshold);
        }
    }

    getSurfaceConfig(): FluidSurfaceConfig {
        return {
            influenceRadius: this.influenceRadius,
            accumScale: this.accumScale,
            threshold: this.threshold
        };
    }

    render(fluid: FlipFluid, config: RenderConfig): void {
        const gl = this.gl;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        if (config.showFluid) {
            this.renderFluid(fluid, config);
        }

        if (config.showParticles || config.showGrid) {
            this.renderPoints(fluid, config);
        }
    }

    private ensureAccumFramebuffer(width: number, height: number): void {
        const gl = this.gl;

        if (
            this.accumWidth === width &&
            this.accumHeight === height &&
            this.accumFramebuffer &&
            this.accumTexture
        ) {
            return;
        }

        this.deleteAccumFramebuffer();

        const tex = gl.createTexture();
        if (!tex) throw new Error('Failed to create accumulation texture');

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const fb = gl.createFramebuffer();
        if (!fb) {
            gl.deleteTexture(tex);
            throw new Error('Failed to create accumulation framebuffer');
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteTexture(tex);
            gl.deleteFramebuffer(fb);
            throw new Error(`Framebuffer incomplete: ${status}`);
        }

        this.accumTexture = tex;
        this.accumFramebuffer = fb;
        this.accumWidth = width;
        this.accumHeight = height;
    }

    private deleteAccumFramebuffer(): void {
        const gl = this.gl;

        if (this.accumFramebuffer) {
            gl.deleteFramebuffer(this.accumFramebuffer);
            this.accumFramebuffer = null;
        }

        if (this.accumTexture) {
            gl.deleteTexture(this.accumTexture);
            this.accumTexture = null;
        }

        this.accumWidth = 0;
        this.accumHeight = 0;
    }

    private renderFluid(fluid: FlipFluid, config: RenderConfig): void {
        const gl = this.gl;
        const w = gl.canvas.width;
        const h = gl.canvas.height;

        if (fluid.numParticles === 0) return;

        this.ensureAccumFramebuffer(w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumFramebuffer);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.blendFunc(gl.ONE, gl.ONE);

        gl.useProgram(this.accumShader);
        gl.uniform2f(gl.getUniformLocation(this.accumShader, 'domainSize'), config.simWidth, config.simHeight);
        gl.uniform1f(gl.getUniformLocation(this.accumShader, 'accumScale'), this.accumScale);

        const radiusPx = this.influenceRadius / config.simWidth * w;
        gl.uniform1f(gl.getUniformLocation(this.accumShader, 'radiusPx'), radiusPx);

        const posLoc = gl.getAttribLocation(this.accumShader, 'attrPosition');
        const colorLoc = gl.getAttribLocation(this.accumShader, 'attrColor');

        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(colorLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fluid.particlePos.subarray(0, 2 * fluid.numParticles), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fluid.particleColor.subarray(0, 3 * fluid.numParticles), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, fluid.numParticles);

        gl.disableVertexAttribArray(posLoc);
        gl.disableVertexAttribArray(colorLoc);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.compositeShader);
        gl.uniform1i(gl.getUniformLocation(this.compositeShader, 'accumTex'), 0);
        gl.uniform1f(gl.getUniformLocation(this.compositeShader, 'threshold'), this.threshold);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.accumTexture);

        const qPosLoc = gl.getAttribLocation(this.compositeShader, 'attrPosition');

        gl.enableVertexAttribArray(qPosLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(qPosLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disableVertexAttribArray(qPosLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    private renderPoints(fluid: FlipFluid, config: RenderConfig): void {
        const gl = this.gl;

        gl.useProgram(this.pointShader);
        gl.uniform2f(gl.getUniformLocation(this.pointShader, 'domainSize'), config.simWidth, config.simHeight);

        const posLoc = gl.getAttribLocation(this.pointShader, 'attrPosition');
        const colorLoc = gl.getAttribLocation(this.pointShader, 'attrColor');

        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(colorLoc);

        if (config.showGrid) {
            const pointSize = 0.9 * fluid.h / config.simWidth * gl.canvas.width;
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'pointSize'), pointSize);
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 0.0);

            if (!this.gridVertBufferInitialized) {
                const cellCenters = new Float32Array(2 * fluid.fNumCells);
                let p = 0;

                for (let i = 0; i < fluid.fNumX; i++) {
                    for (let j = 0; j < fluid.fNumY; j++) {
                        cellCenters[p++] = (i + 0.5) * fluid.h;
                        cellCenters[p++] = (j + 0.5) * fluid.h;
                    }
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, cellCenters, gl.STATIC_DRAW);
                this.gridVertBufferInitialized = true;
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.gridColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.cellColor, gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, fluid.fNumCells);
        }

        if (config.showParticles) {
            const pointSize = 2.0 * fluid.particleRadius / config.simWidth * gl.canvas.width;

            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'pointSize'), pointSize);
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 1.0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.particlePos.subarray(0, 2 * fluid.numParticles), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.particleColor.subarray(0, 3 * fluid.numParticles), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, fluid.numParticles);
        }

        gl.disableVertexAttribArray(posLoc);
        gl.disableVertexAttribArray(colorLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    resize(width: number, height: number): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        canvas.width = width;
        canvas.height = height;
        this.gl.viewport(0, 0, width, height);

        this.deleteAccumFramebuffer();
        this.gridVertBufferInitialized = false;
    }

    dispose(): void {
        const gl = this.gl;

        this.deleteAccumFramebuffer();

        gl.deleteProgram(this.pointShader);
        gl.deleteProgram(this.meshShader);
        gl.deleteProgram(this.accumShader);
        gl.deleteProgram(this.compositeShader);

        gl.deleteBuffer(this.pointVertexBuffer);
        gl.deleteBuffer(this.pointColorBuffer);
        gl.deleteBuffer(this.gridVertBuffer);
        gl.deleteBuffer(this.gridColorBuffer);
        gl.deleteBuffer(this.quadBuffer);
    }
}