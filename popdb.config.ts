export default {
  // Events define the messages that flow through your agent pipeline.
  // Each event can optionally include a JSON Schema for payload validation.
  events: {
    'task.created': {
      displayName: 'Task Created',
    },
  },

  // Tasks are TypeScript functions that process events.
  // Each task listens to one or more events and can emit new events.
  tasks: {
    'on-task-created': {
      file: './tasks/on-task-created.ts',
      listensTo: ['task.created'],
      concurrency: 5,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    },
  },
};
