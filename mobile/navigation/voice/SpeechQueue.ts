/**
 * SpeechQueue.ts
 *
 * Priority-aware speech queue with deduplication, throttling, and stale instruction cancellation.
 * Prevents rapid-fire announcement repetition ("Turn left, Turn left, Turn left") and
 * allows urgent navigational updates (reroute, critical turn) to interrupt outdated instructions.
 */

import type { TTSProvider, VoiceInstruction, VoicePriority } from './types';

const PRIORITY_ORDER: Record<VoicePriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export interface SpeechQueueOptions {
  readonly deduplicationWindowMs?: number; // default: 5000ms
  readonly minIntervalBetweenSpeechMs?: number; // default: 800ms
}

export class SpeechQueue {
  private readonly provider: TTSProvider;
  private readonly deduplicationWindowMs: number;
  private readonly minIntervalBetweenSpeechMs: number;

  private queue: VoiceInstruction[] = [];
  private isProcessing: boolean = false;
  private lastSpokenText: string | null = null;
  private lastSpokenTimestampMs: number = 0;
  private activeInstruction: VoiceInstruction | null = null;

  constructor(provider: TTSProvider, options?: SpeechQueueOptions) {
    this.provider = provider;
    this.deduplicationWindowMs = options?.deduplicationWindowMs ?? 5000;
    this.minIntervalBetweenSpeechMs = options?.minIntervalBetweenSpeechMs ?? 800;
  }

  /**
   * Enqueues a voice instruction.
   * Discards duplicates and prioritizes urgent instructions.
   */
  public enqueue(instruction: VoiceInstruction, nowMs: number = Date.now()): boolean {
    // 1. Deduplication: exact same text spoken recently
    if (
      this.lastSpokenText === instruction.text &&
      nowMs - this.lastSpokenTimestampMs < this.deduplicationWindowMs
    ) {
      return false;
    }

    // 2. Duplicate already in queue
    if (this.queue.some((item) => item.text === instruction.text)) {
      return false;
    }

    // 3. Urgent or High Priority interruption
    if (instruction.priority === 'urgent' || instruction.priority === 'high') {
      // Discard lower-priority pending instructions
      this.queue = this.queue.filter(
        (item) => PRIORITY_ORDER[item.priority] >= PRIORITY_ORDER[instruction.priority]
      );

      // If active instruction is lower priority, stop it
      if (
        this.activeInstruction &&
        PRIORITY_ORDER[this.activeInstruction.priority] < PRIORITY_ORDER[instruction.priority]
      ) {
        this.provider.stop().catch(() => {});
      }
    }

    // 4. Insert into queue maintaining priority order
    let insertIdx = this.queue.length;
    for (let i = 0; i < this.queue.length; i += 1) {
      if (PRIORITY_ORDER[instruction.priority] > PRIORITY_ORDER[this.queue[i].priority]) {
        insertIdx = i;
        break;
      }
    }
    this.queue.splice(insertIdx, 0, instruction);

    // 5. Trigger processing
    this.processQueue();
    return true;
  }

  /**
   * Processes queued instructions sequentially.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const nextItem = this.queue.shift();
      if (!nextItem) break;

      this.activeInstruction = nextItem;
      this.lastSpokenText = nextItem.text;
      this.lastSpokenTimestampMs = Date.now();

      try {
        await this.provider.speak(nextItem.text);
      } catch {
        // Safe disposal on interruption or speech cancellation
      } finally {
        this.activeInstruction = null;
      }

      // Small pause between utterances for natural pacing
      if (this.minIntervalBetweenSpeechMs > 0 && this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.minIntervalBetweenSpeechMs));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Clears all pending instructions and stops current speech.
   */
  public async clear(): Promise<void> {
    this.queue = [];
    this.activeInstruction = null;
    try {
      await this.provider.stop();
    } catch {
      // Safe disposal
    }
    this.isProcessing = false;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveInstruction(): VoiceInstruction | null {
    return this.activeInstruction;
  }
}
