---
title: Real-time Collaboration
layout: home
nav_order: 7
---

# Real-time Collaboration

LinkedRecords provides built-in real-time collaboration features that allow multiple users to work on the same data simultaneously. The system uses WebSockets for real-time communication and implements conflict resolution strategies for different data types.

## Overview

LinkedRecords supports real-time collaboration through:

- **WebSocket Connections**: Real-time bidirectional communication
- **Conflict-Free Replicated Data Types (CRDT)**: For key-value attributes
- **Operational Transformation (OT)**: For long text attributes
- **Automatic Synchronization**: Changes are automatically propagated to all connected clients

## WebSocket Connection

### Connection Management

The LinkedRecords client automatically manages WebSocket connections:

```javascript
// Initialize client with real-time support
const client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));

// The WebSocket connection is established automatically
// when you first access an attribute
const attribute = await client.Attribute.findById('kv-123456');
```

### Connection Handlers

Set up handlers for connection events:

```javascript
// Handle connection loss
client.connectionLostHandler = (err) => {
  console.error('Connection lost:', err);
  // Implement reconnection logic or show offline indicator
};

// Handle successful reconnection
client.loginHandler = () => {
  console.log('Reconnected successfully');
  // Refresh UI or sync data
};
```

## Collaborative Key-Value Attributes

Key-value attributes use CRDT (Conflict-Free Replicated Data Types) for conflict resolution:

```javascript
// Create a collaborative document
const document = await client.Attribute.create('keyValue', {
  title: 'Collaborative Document',
  content: 'Initial content',
  metadata: {
    author: 'John Doe',
    created: new Date().toISOString()
  }
});

// Multiple users can edit simultaneously
// Changes are automatically merged using CRDT
await document.patch({
  'title': 'Updated Title',
  'metadata.lastModified': new Date().toISOString()
});
```

### Real-time Updates

Subscribe to changes in real-time:

```javascript
// Subscribe to changes
document.subscribe((change) => {
  console.log('Document changed:', change);

  // Update your UI
  updateDocumentUI(change);
});

// Unsubscribe when done
document.unsubscribe();
```

### Conflict Resolution

CRDT ensures that concurrent edits are automatically resolved:

```javascript
// User A edits the document
await document.patch({
  'title': 'User A Title',
  'content': 'User A content'
});

// User B simultaneously edits the document
await document.patch({
  'title': 'User B Title',
  'metadata.author': 'Jane Doe'
});

// Both changes are automatically merged
// No conflicts occur due to CRDT
```

## Collaborative Long Text

Long text attributes use Operational Transformation (OT) for real-time collaborative editing:

```javascript
// Create a collaborative text document
const textDocument = await client.Attribute.create('longText', 'Initial text content');

// Multiple users can edit the text simultaneously
// OT ensures consistency across all clients
await textDocument.set('Updated text content with more details...');
```

### Real-time Text Editing

```javascript
// Subscribe to text changes
textDocument.subscribe((change) => {
  console.log('Text changed:', change);

  // Update your text editor
  updateTextEditor(change);
});

// The text editor can send changes in real-time
// as users type
function onTextChange(newText) {
  textDocument.set(newText);
}
```

### Operational Transformation Benefits

OT provides several advantages for text collaboration:

- **Consistency**: All users see the same final result
- **Real-time**: Changes appear instantly for all users
- **Conflict-free**: No manual conflict resolution needed
- **Performance**: Efficient for large documents

## Collaborative Blob Attributes

Blob attributes support real-time updates for file sharing:

```javascript
// Create a collaborative file
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const blob = new Blob([file], { type: file.type });

const collaborativeFile = await client.Attribute.create('blob', blob);

// Subscribe to file updates
collaborativeFile.subscribe((change) => {
  console.log('File updated:', change);
  // Update file viewer or download link
});
```

## Real-time Facts

Facts also support real-time updates:

```javascript
// Create facts that update in real-time
await client.Fact.createAll([
  [userId, 'isA', 'User'],
  [postId, 'hasAuthor', userId],
  [postId, 'hasStatus', 'draft']
]);

// Other users will see these facts immediately
// when they query for them
const userPosts = await client.Attribute.findAll({
  userPosts: [
    ['hasAuthor', userId],
    ['hasStatus', 'draft']
  ]
});
```

## Building Collaborative Applications

### Real-time Chat Application

```javascript
// Create a chat room
const chatRoom = await client.Attribute.create('keyValue', {
  name: 'General Chat',
  participants: [],
  messages: []
});

// Subscribe to chat updates
chatRoom.subscribe((change) => {
  console.log('Chat updated:', change);
  updateChatUI(change);
});

// Send a message
async function sendMessage(message) {
  const currentValue = await chatRoom.getValue();
  const messages = currentValue.messages || [];

  await chatRoom.patch({
    'messages': [...messages, {
      id: Date.now(),
      text: message,
      author: await client.ensureUserIdIsKnown(),
      timestamp: new Date().toISOString()
    }]
  });
}
```

### Real-time Document Editor

```javascript
// Create a collaborative document
const document = await client.Attribute.create('longText', 'Start writing here...');

// Set up real-time editing
document.subscribe((change) => {
  // Update the editor content
  editor.setValue(change.value);
});

// Handle editor changes
editor.on('change', (newValue) => {
  document.set(newValue);
});
```

### Real-time Project Management

```javascript
// Create a project with real-time updates
const project = await client.Attribute.create('keyValue', {
  name: 'My Project',
  tasks: [],
  status: 'active'
});

// Subscribe to project changes
project.subscribe((change) => {
  updateProjectDashboard(change);
});

// Add a task
async function addTask(taskName) {
  const currentValue = await project.getValue();
  const tasks = currentValue.tasks || [];

  await project.patch({
    'tasks': [...tasks, {
      id: Date.now(),
      name: taskName,
      status: 'pending',
      assignedTo: null
    }]
  });
}
```

## Performance Considerations

### Optimizing Real-time Updates

```javascript
// Debounce frequent updates
let updateTimeout;
function debouncedUpdate(attribute, value) {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    attribute.set(value);
  }, 300); // Wait 300ms before sending update
}

// Use for text editing
editor.on('change', (newValue) => {
  debouncedUpdate(document, newValue);
});
```

### Handling Large Datasets

```javascript
// For large collaborative datasets, consider pagination
const { items } = await client.Attribute.findAll({
  items: [
    ['isA', 'DataItem'],
    ['belongsTo', projectId]
  ]
});

// Subscribe only to specific items
const importantItem = await client.Attribute.findById('important-item-id');
importantItem.subscribe((change) => {
  updateImportantItem(change);
});
```

## Error Handling

### Connection Issues

```javascript
// Handle connection problems
client.connectionLostHandler = (err) => {
  console.error('Connection lost:', err);

  // Show offline indicator
  showOfflineIndicator();

  // Attempt reconnection
  setTimeout(() => {
    client.reconnect();
  }, 5000);
};

// Handle successful reconnection
client.loginHandler = () => {
  console.log('Reconnected');
  hideOfflineIndicator();

  // Refresh data
  refreshData();
};
```

### Sync Conflicts

```javascript
// Handle sync issues
try {
  await attribute.set(newValue);
} catch (error) {
  if (error.message.includes('sync')) {
    console.error('Sync conflict:', error);

    // Refresh the attribute to get latest state
    await attribute.load();

    // Retry the operation
    await attribute.set(newValue);
  }
}
```

## Best Practices

### 1. Efficient Subscriptions

```javascript
// Subscribe only when needed
let isSubscribed = false;

function startCollaboration() {
  if (!isSubscribed) {
    document.subscribe(handleChange);
    isSubscribed = true;
  }
}

function stopCollaboration() {
  if (isSubscribed) {
    document.unsubscribe();
    isSubscribed = false;
  }
}
```

### 2. Optimistic Updates

```javascript
// Update UI immediately, then sync
async function updateDocument(newValue) {
  // Update UI immediately
  updateUI(newValue);

  try {
    // Sync with server
    await document.set(newValue);
  } catch (error) {
    // Revert UI if sync fails
    console.error('Sync failed:', error);
    updateUI(await document.getValue());
  }
}
```

### 3. Connection State Management

```javascript
// Track connection state
let isConnected = true;

client.connectionLostHandler = () => {
  isConnected = false;
  updateConnectionStatus('disconnected');
};

client.loginHandler = () => {
  isConnected = true;
  updateConnectionStatus('connected');
};

// Check connection before operations
async function safeUpdate(value) {
  if (!isConnected) {
    // Queue updates for when connection is restored
    queueUpdate(value);
    return;
  }

  await document.set(value);
}
```

### 4. User Presence

```javascript
// Track user presence
const presence = await client.Attribute.create('keyValue', {
  userId: await client.ensureUserIdIsKnown(),
  status: 'online',
  lastSeen: new Date().toISOString()
});

// Update presence periodically
setInterval(async () => {
  await presence.patch({
    'lastSeen': new Date().toISOString()
  });
}, 30000); // Update every 30 seconds
```

## Next Steps

- [Authorization](authorization.md) - Control who can collaborate on data
- [Advanced Queries](queries.md) - Query collaborative data efficiently
- [Performance Optimization](performance.md) - Optimize real-time performance
