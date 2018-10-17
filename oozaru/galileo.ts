/*
 *  Oozaru JavaScript game engine
 *  Copyright (c) 2015-2018, Fat Cerberus
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 *  * Neither the name of miniSphere nor the names of its contributors may be
 *    used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 *  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 *  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 *  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 *  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
**/

let
	activeShader : Shader,
	activeSurface : Surface,
	gl : WebGLRenderingContext,
	defaultShader : Shader,
	screenCanvas : HTMLCanvasElement;

export default
class Galileo extends null
{
	static async initialize(canvas: HTMLCanvasElement)
	{
		screenCanvas = canvas;
		gl = <WebGLRenderingContext> screenCanvas.getContext('webgl');
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);

		let vertSource = await (await fetch('shaders/default.vert.glsl')).text();
		let fragSource = await (await fetch('shaders/default.frag.glsl')).text();
		defaultShader = new Shader(vertSource, fragSource);

		Surface.Screen.activate();
	}
}
export enum ShapeType  {
	Fan,
	Lines,
	LineLoop,
	LineStrip,
	Points,
	Triangles,
	TriStrip
}

export
class Color
{
	data : {
		r : number,
		g : number,
		b : number,
		a : number
	}
	constructor(r : number, g : number, b : number, a = 1.0)
	{
		this.data = { r, g, b, a };
	}
}

export
class IndexBuffer
{
	hwBuffer : WebGLBuffer;
	length : number
	constructor(indices : number[])
	{
		let data = new Uint16Array(indices);
		let hwBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hwBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);

		if (hwBuffer === null) {
			throw new Error ("WebGl failed to attach buffer");
		}

		this.hwBuffer = hwBuffer;
		this.length = indices.length;
	}

	activate()
	{
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.hwBuffer);
	}
}

export
class Prim extends null
{
	static clear()
	{
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	static rerez(width : number, height : number)
	{
		screenCanvas.width = width;
		screenCanvas.height = height;
		if (activeSurface === Surface.Screen)
			gl.viewport(0, 0, screenCanvas.width, screenCanvas.height);
	}
}

export
class Shader
{
	static get Default()
	{
		return defaultShader;
	}

	hwShader : WebGLProgram;
	hasTextureLoc : WebGLUniformLocation;
	modelViewLoc : WebGLUniformLocation;
	textureLoc : WebGLUniformLocation
	transform : Transform

	constructor(vertexSource : string, fragmentSource : string)
	{
		let hwShader = <WebGLProgram> gl.createProgram();

		let vertShader = <WebGLShader> gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertShader, vertexSource);
		gl.compileShader(vertShader);
		if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
			let message = gl.getShaderInfoLog(vertShader);
			throw new Error(`Couldn't compile vertex shader...\n${message}`);
		}

		let fragShader = <WebGLShader> gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragShader, fragmentSource);
		gl.compileShader(fragShader);
		if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
			let message = gl.getShaderInfoLog(fragShader);
			throw new Error(`Couldn't compile fragment shader...\n${message}`);
		}

		gl.attachShader(hwShader, vertShader);
		gl.attachShader(hwShader, fragShader);
		gl.bindAttribLocation(hwShader, 0, 'al_pos');
		gl.bindAttribLocation(hwShader, 1, 'al_color');
		gl.bindAttribLocation(hwShader, 2, 'al_texcoord');
		gl.linkProgram(hwShader);
		if (!gl.getProgramParameter(hwShader, gl.LINK_STATUS)) {
			let message = gl.getProgramInfoLog(hwShader);
			throw new Error(`Couldn't link shader program...\n${message}`);
		}

		this.hwShader = hwShader;
		this.hasTextureLoc = <WebGLUniformLocation> gl.getUniformLocation(hwShader, 'al_use_tex');
		this.modelViewLoc = <WebGLUniformLocation> gl.getUniformLocation(hwShader, 'al_projview_matrix');
		this.textureLoc = <WebGLUniformLocation> gl.getUniformLocation(hwShader, 'al_tex');
		this.transform = new Transform();
	}

	activate(useTexture : boolean)
	{
		if (activeShader !== this) {
			gl.useProgram(this.hwShader);
			activeShader = this;
		}
		this.transform.identity();
		this.transform.ortho(0, 0, activeSurface.width, activeSurface.height);
		gl.uniform1i(this.hasTextureLoc, useTexture ? 1 : 0);
		gl.uniform1i(this.textureLoc, 0);
		gl.uniformMatrix4fv(this.modelViewLoc, false, this.transform.matrix);
	}
}

export
class Shape
{
	type : ShapeType;
	vertices : VertexBuffer;
	indices : IndexBuffer;

	constructor(vertexBuffer : VertexBuffer, indexBuffer : IndexBuffer, type = ShapeType.TriStrip)
	{
		this.type = type;
		this.vertices = vertexBuffer;
		this.indices = indexBuffer;
	}

	draw()
	{
		let drawMode = this.type === ShapeType.Fan ? gl.TRIANGLE_FAN
			: this.type === ShapeType.Lines ? gl.LINES
			: this.type === ShapeType.LineLoop ? gl.LINE_LOOP
			: this.type === ShapeType.LineStrip ? gl.LINE_STRIP
			: this.type === ShapeType.Points ? gl.POINTS
			: this.type === ShapeType.TriStrip ? gl.TRIANGLE_STRIP
			: gl.TRIANGLES;
		this.vertices.activate();
		if (this.indices !== null) {
			this.indices.activate();
			gl.drawElements(drawMode, this.indices.length, gl.UNSIGNED_SHORT, 0);
		}
		else {
			gl.drawArrays(drawMode, 0, this.vertices.length);
		}
	}
}

export
class Surface
{
	static get Screen()
	{
		let screenSurface = Object.create(Surface.prototype);
		screenSurface.frameBuffer = null;
		Object.defineProperty(this, 'Screen', {
			writable: false,
			enumerable: false,
			configurable: true,
			value: screenSurface,
		});
		return screenSurface;
	}

	frameBuffer: WebGLBuffer;
	texture : Texture;

	constructor(texture : Texture)
	{
		let frameBuffer = <WebGLBuffer> gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D, texture.hwTexture, 0);

		this.frameBuffer = frameBuffer;
		this.texture = texture;
	}

	get height()
	{
		return this.frameBuffer !== null
			? this.texture.height
			: screenCanvas.height;
	}

	get width()
	{
		return this.frameBuffer !== null
			? this.texture.width
			: screenCanvas.width;
	}

	activate()
	{
		if (activeSurface === this)
			return;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
		if (this.frameBuffer !== null)
			gl.viewport(0, 0, this.texture.width, this.texture.height);
		else
			gl.viewport(0, 0, screenCanvas.width, screenCanvas.height);
		activeSurface = this;
	}
}

export
class Texture
{
	hwTexture : WebGLTexture;
	width : number;
	height : number;
	constructor(image : HTMLImageElement)
	{
		this.hwTexture = <WebGLTexture> gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.hwTexture);
		//@ts-ignore - Typescript has wrong typeinfo for gl.pixelStorei
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		this.width = image.width;
		this.height = image.height;
	}

	activate(textureUnit = 0)
	{
		gl.activeTexture(gl.TEXTURE0 + textureUnit);
		gl.bindTexture(gl.TEXTURE_2D, this.hwTexture);
	}
}

export
class Transform
{
	matrix : Float32Array;
	constructor()
	{
		this.matrix = new Float32Array(4 * 4);
		this.identity();
	}

	clone()
	{
		let dolly = new Transform();
		dolly.matrix.set(this.matrix);
	}

	identity()
	{
		this.matrix.set([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0,
		]);
	}

	ortho(left : number, top : number, right : number, bottom : number, near = -1.0, far = 1.0)
	{
		let sX = 2 / (right - left);
		let sY = 2 / (top - bottom);
		let sZ = -2 / (far - near);
		let tX = -(right + left) / (right - left);
		let tY = -(top + bottom) / (top - bottom);
		let tZ = (far + near) / (far - near);
		this.matrix.set([
			sX,  0.0, 0.0, 0.0,
			0.0, sY,  0.0, 0.0,
			0.0, 0.0, sZ,  0.0,
			tX,  tY,  tZ,  1.0,
		]);
	}
}



export
class VertexBuffer
{
	hwBuffer : WebGLBuffer;
	length : number;
	
	constructor(vertices : { x? : number, y? : number, z? : number, u? : number, v? : number, color? : { r: number, g : number, b : number, a : number}}[])
	{
		let data = new Float32Array(10 * vertices.length);
		for (let i = 0, len = vertices.length; i < len; ++i) {
			let vertex = vertices[i];
			if (vertex.x !== undefined)
				data[0 + i * 10] = vertex.x;
			if (vertex.y !== undefined)
				data[1 + i * 10] = vertex.y;
			data[2 + i * 10] = 0.0;
			data[3 + i * 10] = 1.0;
			if (vertex.color !== undefined) {
				data[4 + i * 10] = vertex.color.r;
				data[5 + i * 10] = vertex.color.g;
				data[6 + i * 10] = vertex.color.b;
				data[7 + i * 10] = vertex.color.a;
			}
			else {
				data[4 + i * 10] = 1.0;
				data[5 + i * 10] = 1.0;
				data[6 + i * 10] = 1.0;
				data[7 + i * 10] = 1.0;
			}
			if (vertex.u !== undefined && vertex.v !== undefined) {
				data[8 + i * 10] = vertex.u;
				data[9 + i * 10] = vertex.v;
			}
		}
		this.hwBuffer = <WebGLBuffer> gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.hwBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	
		this.length = vertices.length;
	}

	activate()
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, this.hwBuffer);
		gl.enableVertexAttribArray(0);
		gl.enableVertexAttribArray(1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 40, 0);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 16);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 32);
	}
}
