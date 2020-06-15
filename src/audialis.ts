/*
 *  Oozaru JavaScript game engine
 *  Copyright (c) 2015-2020, Fat Cerberus
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

import Deque from './deque.js';
import preFIX from './prefix.js';
import * as util from './utility.js';

// @ts-ignore: TS doesn't define AudioContext on Window
const AudioContext = preFIX('AudioContext');

export
class Mixer
{
	context: AudioContext;
	promise: Promise<void>;
	gainer: GainNode;

	constructor(sampleRate: number)
	{
		this.context = new AudioContext({ sampleRate });
		this.promise = this.context.audioWorklet.addModule('scripts/workers/buffer-player.js');
		this.gainer = this.context.createGain();
		this.gainer.gain.value = 1.0;
		this.gainer.connect(this.context.destination);
	}

	get volume()
	{
		return this.gainer.gain.value;
	}

	set volume(value)
	{
		this.gainer.gain.value = value;
	}
}

export
class Sound
{
	media: HTMLAudioElement;
	mixer?: Mixer;
	node?: MediaElementAudioSourceNode;

	static async fromFile(url: string)
	{
		const media = await util.fetchAudio(url);
		media.loop = true;
		return new this(media);
	}

	constructor(audioElement: HTMLAudioElement)
	{
		this.media = audioElement;
	}

	get length()
	{
		return this.media.duration;
	}

	get position()
	{
		return this.media.currentTime;
	}

	get repeat()
	{
		return this.media.loop;
	}

	get volume()
	{
		return this.media.volume;
	}

	set position(value)
	{
		this.media.currentTime = value;
	}

	set repeat(value)
	{
		this.media.loop = value;
	}

	set volume(value)
	{
		this.media.volume = value;
	}

	pause()
	{
		this.media.pause();
	}

	play(mixer: Mixer)
	{
		if (mixer !== this.mixer) {
			this.mixer = mixer;
			if (this.node !== undefined)
				this.node.disconnect();
			this.node = mixer.context.createMediaElementSource(this.media);
			this.node.connect(mixer.gainer);
		}

		this.media.play();
	}

	stop()
	{
		this.media.pause();
		this.media.currentTime = 0.0;
	}
}

export
class Stream
{
	private buffers: Deque<Float32Array> = new Deque();
	private inputPtr = 0.0;
	private mixer: Mixer | null = null;
	private node?: AudioWorkletNode;
	private numChannels: number;
	private paused = true;
	private sampleRate: number;
	private timeBuffered = 0.0;

	constructor(sampleRate: number, numChannels: number)
	{
		this.numChannels = numChannels;
		this.sampleRate = sampleRate;
	}

	get buffered()
	{
		return this.timeBuffered;
	}

	buffer(data: Float32Array)
	{
		if (this.node !== undefined) {
			this.node.port.postMessage(data);
		}
		else {
			this.buffers.push(data);
		}
	}

	pause()
	{
		this.paused = true;
	}

	async play(mixer?: Mixer)
	{
		// IMPORTANT: the first call to .play() must specify a mixer.  not doing so invokes undefined
		//            behavior and I can't be held responsible for what happens afterwards.  if you do
		//            this and it summons an evil man-eating pig that devours you, your dog, your house,
		//            and everything else in a hundred-mile radius, don't blame me!

		this.paused = false;
		if (mixer !== undefined && mixer !== this.mixer) {
			if (this.node !== undefined)
				this.node.disconnect();
			await mixer.promise;
			this.node = new AudioWorkletNode(mixer.context, 'buffer-processor', {
				numberOfInputs: 0,
				outputChannelCount: [ this.numChannels ],
			});
			for (const buffer of this.buffers)
				this.node.port.postMessage(buffer);
			this.node.connect(mixer.gainer);
			this.mixer = mixer;
		}
	}

	stop()
	{
		if (this.node !== undefined)
			this.node.disconnect();
		this.buffers.clear();
		this.inputPtr = 0.0;
		this.mixer = null;
		this.node = undefined;
		this.paused = true;
		this.timeBuffered = 0.0;
	}
}
