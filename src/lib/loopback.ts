import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export class LoopbackBridge {
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private cancelListen: (() => void) | null = null

  async ensureNode() {
    if (this.ctx && this.node) return
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    try { await this.ctx.audioWorklet.addModule('/src/analysis/pcm-source.worklet.js') } catch {
      await this.ctx.audioWorklet.addModule('analysis/pcm-source.worklet.js')
    }
    this.node = new AudioWorkletNode(this.ctx, 'pcm-source', { numberOfOutputs: 1, outputChannelCount: [1] })
  }

  /** Connect the PCM source output to a destination node (e.g., analyzer worklet). */
  async connectTo(dest: AudioNode) {
    await this.ensureNode()
    this.node!.connect(dest)
  }

  async start() {
    await this.ensureNode()
    if (this.ctx!.state === 'suspended') await this.ctx!.resume()
    // Subscribe to plugin events
    if (!this.cancelListen) {
      const un = await listen<{ pcm_base64: string }>('loopback:pcm', (e) => {
        const base64 = (e.payload as any).pcm_base64 || (e.payload as any).pcmBase64 || (e.payload as any).pcm
        if (!base64) return
        const binStr = atob(base64)
        const len = binStr.length
        const bytes = new Uint8Array(len)
        for (let i=0;i<len;i++) bytes[i] = binStr.charCodeAt(i)
        const buffer = bytes.buffer
        this.node!.port.postMessage({ buffer }, [buffer])
      })
      this.cancelListen = un as unknown as () => void
    }
    await invoke('startLoopback')
  }

  async stop() {
    try { await invoke('stopLoopback') } catch {}
    if (this.cancelListen) { this.cancelListen(); this.cancelListen = null }
    try { this.node?.disconnect() } catch {}
  }

  getAudioNode() { return this.node }
  getContext() { return this.ctx }
}

export default LoopbackBridge
