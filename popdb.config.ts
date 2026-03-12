export default {
  // Event types define the messages that flow through your event pipeline.
  // Each event type can optionally include a JSON Schema for payload validation.
  eventTypes: {
    'task.created': {
      displayName: 'Task Created',
    },
  },

  // Handlers are TypeScript functions that process events.
  // Each handler listens to one or more event types and can emit new events.
  handlers: {
    'on-task-created': {
      file: './handlers/on-task-created.ts',
      listensTo: ['task.created'],
      concurrency: 5,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    },
  },
};
