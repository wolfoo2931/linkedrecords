import RedisQueuedTasks from './redis_queued_tasks';
import InMemoryQueuedTasks from './In_memory_queued_tasks';

let queue;

export interface IsQueue {
  do: (queueName: string, fn: () => Promise<any>) => Promise<any>,
}

export default class QueuedTasks {
  static create(): IsQueue {
    if (queue) {
      return queue;
    }

    if (process.env['REDIS_HOST']) {
      queue = new RedisQueuedTasks();
    } else {
      queue = new InMemoryQueuedTasks();
    }

    return queue;
  }
}
