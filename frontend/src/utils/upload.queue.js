export class UploadQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.activeCount = 0;
  }

  add(id, task) {
    this.queue.push({ id, task });

    // Try to start the task immediately
    this.process();
  }

  remove(id) {
    const index = this.queue.findIndex((item) => item.id === id);

    if (index === -1) return false;

    this.queue.splice(index, 1);

    return true;
  }

  async process() {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const item = this.queue.shift();
      this.activeCount++;

      try {
        await item.task();
      } finally {
        this.activeCount--;

        // A task is finished
        // There might be another pending task now
        this.process();
      }
    }
  }
}
