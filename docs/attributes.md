---
title: Attributes
layout: home
nav_order: 2
---

# Attributes

Attributes are the basic building blocks of LinkedRecords. While in a document database, you would
create documents in a collection and in SQL you would create rows in a table, in LinkedRecords you
would create an attribute but it would not belong to a collection nor table. It just exists on its
own. In the most basic form you would retrieve an attribute by its ID. In the facts section you
will see how to query for attributes even if they do not belong to any table or collection.

## Attribute Types

LinkedRecords supports three types of attributes:

### 1. Key-Value Attributes (`keyValue`)

Key-value attributes store structured data as JSON objects. They support nested objects and arrays, and use a flat structure internally for efficient updates.

```javascript
// Create a key-value attribute
const userProfile = await client.Attribute.create('keyValue', {
  name: 'John Doe',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    notifications: true
  },
  tags: ['developer', 'admin']
});

// Update specific fields
await userProfile.patch({
  'preferences.theme': 'light',
  'tags': ['developer', 'admin', 'moderator']
});

// Get the current value
const value = await userProfile.getValue();
console.log(value.name); // 'John Doe'
```

### 2. Long Text Attributes (`longText`)

Long text attributes are designed for large text content with real-time collaborative editing support using operational transformation (OT).

```javascript
// Create a long text attribute
const document = await client.Attribute.create('longText', 'Initial content');

// Update the content
await document.set('Updated content with more text...');

// Get the current content
const content = await document.getValue();
console.log(content); // 'Updated content with more text...'
```

### 3. Blob Attributes (`blob`)

Blob attributes store binary data such as images, documents, or any file type.

```javascript
// Create a blob attribute from a file
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const blob = new Blob([file], { type: file.type });

const imageAttribute = await client.Attribute.create('blob', blob);

// Get the blob data
const retrievedBlob = await imageAttribute.getValue();
```

## Creating Attributes

### Single Attribute Creation

```javascript
// Create a key-value attribute
const kvAttribute = await client.Attribute.create('keyValue', { foo: 'bar' });

// Create a long text attribute
const textAttribute = await client.Attribute.create('longText', 'Hello, world!');

// Create a blob attribute
const blobAttribute = await client.Attribute.create('blob', new Blob(['data']));
```

### Batch Attribute Creation

You can create multiple attributes at once using `createAll`:

```javascript
const { user, profile, settings } = await client.Attribute.createAll({
  user: {
    type: 'KeyValueAttribute',
    value: { name: 'John Doe', email: 'john@example.com' }
  },
  profile: {
    type: 'LongTextAttribute',
    value: 'This is my profile description...'
  },
  settings: {
    type: 'KeyValueAttribute',
    value: { theme: 'dark', notifications: true }
  }
});
```

## Finding and Loading Attributes

### By ID

```javascript
// Load an attribute by its ID
const attribute = await client.Attribute.findById('kv-123456');
if (attribute) {
  const value = await attribute.getValue();
  console.log(value);
}
```

### By Facts (Queries)

You can find attributes based on their relationships using facts:

```javascript
// Find all attributes that are of type 'User'
const { users } = await client.Attribute.findAll({
  users: [['isA', 'User']]
});

// Find attributes with multiple conditions
const { userPosts } = await client.Attribute.findAll({
  userPosts: [
    ['isA', 'Post'],
    ['belongsTo', userId]
  ]
});
```

### Complex Queries with Composition

```javascript
const { content, references, referenceSources } = await client.Attribute.findAndLoadAll({
  content: contentId,
  references: [
    ['belongsTo', contentId],
    ['isA', 'referenceStore']
  ],
  referenceSources: [
    ['belongsTo', contentId],
    ['isA', 'referenceSourceStore'],
    ['belongsTo', userId]
  ]
});
```

## Updating Attributes

### Key-Value Attributes

```javascript
// Patch specific fields
await kvAttribute.patch({
  'name': 'Jane Doe',
  'preferences.theme': 'light',
  'tags': ['admin', 'moderator']
});

// Set the entire value
await kvAttribute.set({
  name: 'Jane Doe',
  email: 'jane@example.com',
  preferences: { theme: 'light' }
});
```

### Long Text Attributes

```javascript
// Set new content
await textAttribute.set('New content for the document');

// Real-time collaborative editing is supported automatically
// Multiple users can edit the same document simultaneously
```

### Blob Attributes

```javascript
// Update with new blob data
const newBlob = new Blob(['new data'], { type: 'text/plain' });
await blobAttribute.set(newBlob);
```

## Real-time Collaboration

LinkedRecords provides real-time collaboration out of the box:

```javascript
// Subscribe to changes
kvAttribute.subscribe((change) => {
  console.log('Attribute changed:', change);
});

// Unsubscribe when done
kvAttribute.unsubscribe();
```

## Attribute Lifecycle

1. **Creation**: Attributes are created with an initial value
2. **Loading**: Attributes are loaded from the server when accessed
3. **Modification**: Changes are applied locally and synchronized with the server
4. **Deletion**: Attributes can be deleted (though this is typically handled through facts)

## Best Practices

- **Use appropriate attribute types**: Use key-value for structured data, long text for documents, and blob for binary data
- **Batch operations**: Use `createAll` and `findAndLoadAll` for better performance
- **Handle loading states**: Always check if attributes are loaded before accessing their values
- **Subscribe to changes**: Use the subscription API for real-time updates in your UI
- **Error handling**: Always handle cases where attributes might not exist or fail to load

## Next Steps

- [Facts](facts.md) - Learn how to create relationships between attributes
- [Authorization](authorization.md) - Understand how to control access to attributes
- [Real-time Collaboration](realtime.md) - Deep dive into collaborative features