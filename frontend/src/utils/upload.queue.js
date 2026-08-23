export class UploadQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.activeCount = 0;
  }

  add(task) {
    this.queue.push(task);

    // Try to start the task immediately
    this.process();
  }

  async process() {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const task = this.queue.shift();
      this.activeCount++;

      try {
        await task();
      } finally {
        this.activeCount--;

        // A task is finished
        // There might be another pending task now
        this.process();
      }
    }
  }
}
