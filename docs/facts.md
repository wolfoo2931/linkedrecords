---
title: Facts
layout: home
nav_order: 3
---

# Facts

Facts are the relationship system in LinkedRecords. They allow you to create connections between attributes and define metadata about your data. Facts follow a simple triple pattern: `[subject, predicate, object]`.

## Understanding Facts

A fact consists of three parts:
- **Subject**: The attribute or entity that the fact is about
- **Predicate**: The type of relationship or property
- **Object**: The target of the relationship or the property value

## Creating Facts

### Basic Fact Creation

```javascript
// Create a single fact
await client.Fact.createAll([
  [userId, 'isA', 'User']
]);

// Create multiple facts at once
await client.Fact.createAll([
  [userId, 'isA', 'User'],
  [postId, 'isA', 'Post'],
  [postId, 'belongsTo', userId],
  [postId, 'hasTitle', 'My First Post']
]);
```

### Defining Terminology

Before using custom predicates, it's good practice to define them:

```javascript
// Define what terms mean
await client.Fact.createAll([
  ['User', '$isATermFor', 'A person who uses the system'],
  ['Post', '$isATermFor', 'A piece of content created by a user'],
  ['belongsTo', '$isATermFor', 'Indicates ownership or association'],
  ['hasTitle', '$isATermFor', 'The title of a piece of content']
]);
```

## Querying Facts

### Finding Facts by Subject

```javascript
// Find all facts about a specific user
const userFacts = await client.Fact.findAll({
  subject: [userId]
});

console.log(userFacts);
// [
//   { subject: 'user-123', predicate: 'isA', object: 'User' },
//   { subject: 'user-123', predicate: 'hasName', object: 'John Doe' }
// ]
```

### Finding Facts by Predicate

```javascript
// Find all facts with a specific predicate
const allUsers = await client.Fact.findAll({
  predicate: ['isA']
});

// Find all facts where the object is 'User'
const userFacts = await client.Fact.findAll({
  object: ['User']
});
```

### Complex Queries

```javascript
// Find facts with multiple conditions
const userPosts = await client.Fact.findAll({
  subject: [userId],
  predicate: ['belongsTo']
});

// Find facts about posts that belong to a user
const postFacts = await client.Fact.findAll({
  subject: [postId],
  predicate: ['belongsTo', 'hasTitle', 'isA']
});
```

## Using Facts with Attributes

### Finding Attributes by Facts

```javascript
// Find all attributes that are users
const { users } = await client.Attribute.findAll({
  users: [['isA', 'User']]
});

// Find posts that belong to a specific user
const { userPosts } = await client.Attribute.findAll({
  userPosts: [
    ['isA', 'Post'],
    ['belongsTo', userId]
  ]
});
```

### Creating Related Data

```javascript
// Create a user and their profile
const user = await client.Attribute.create('keyValue', { name: 'John Doe' });
const profile = await client.Attribute.create('longText', 'John is a developer...');

// Create facts to relate them
await client.Fact.createAll([
  [user.id, 'isA', 'User'],
  [profile.id, 'isA', 'Profile'],
  [profile.id, 'belongsTo', user.id]
]);
```

## Special Predicates

LinkedRecords has several special predicates that have built-in meaning:

### `$isATermFor`
Defines what a term means in your system.

```javascript
await client.Fact.createAll([
  ['User', '$isATermFor', 'A person who uses the system'],
  ['Post', '$isATermFor', 'A piece of content'],
  ['belongsTo', '$isATermFor', 'Indicates ownership']
]);
```

### `$isAccountableFor`
Used in the authorization system to define who is responsible for data.

```javascript
await client.Fact.createAll([
  [userId, '$isAccountableFor', attributeId]
]);
```

### Authorization Predicates
These are used for access control:

- `$canRead` - Permission to read data
- `$canWrite` - Permission to write data
- `$canDelete` - Permission to delete data
- `$canReferTo` - Permission to reference data
- `$canRefine` - Permission to modify relationships
- `$isMemberOf` - Membership in a group
- `$isHostOf` - Hosting relationship for groups

## Deleting Facts

```javascript
// Delete specific facts
await client.Fact.deleteAll([
  [postId, 'belongsTo', oldUserId],
  [postId, 'hasTitle', 'Old Title']
]);
```

## Best Practices

### 1. Define Your Vocabulary

Always define your terms before using them:

```javascript
// Define your domain vocabulary
await client.Fact.createAll([
  ['User', '$isATermFor', 'A person who uses the system'],
  ['Post', '$isATermFor', 'A piece of content'],
  ['Comment', '$isATermFor', 'A response to a post'],
  ['belongsTo', '$isATermFor', 'Indicates ownership'],
  ['hasAuthor', '$isATermFor', 'The creator of content'],
  ['hasContent', '$isATermFor', 'The main content of an item']
]);
```

### 2. Use Consistent Naming

Stick to a consistent naming convention for your predicates:

```javascript
// Good: Consistent naming
['user-123', 'hasName', 'John Doe']
['user-123', 'hasEmail', 'john@example.com']
['user-123', 'hasProfile', 'profile-456']

// Avoid: Inconsistent naming
['user-123', 'name', 'John Doe']
['user-123', 'email', 'john@example.com']
['user-123', 'profile', 'profile-456']
```

### 3. Batch Operations

Use batch operations for better performance:

```javascript
// Good: Batch creation
await client.Fact.createAll([
  [postId, 'isA', 'Post'],
  [postId, 'hasTitle', 'My Post'],
  [postId, 'hasAuthor', userId],
  [postId, 'hasContent', contentId]
]);

// Avoid: Individual creation
await client.Fact.createAll([[postId, 'isA', 'Post']]);
await client.Fact.createAll([[postId, 'hasTitle', 'My Post']]);
// ... etc
```

### 4. Use Facts for Queries

Leverage facts to create powerful queries:

```javascript
// Find all posts by a specific user
const { userPosts } = await client.Attribute.findAll({
  userPosts: [
    ['isA', 'Post'],
    ['hasAuthor', userId]
  ]
});

// Find all comments on a specific post
const { postComments } = await client.Attribute.findAll({
  postComments: [
    ['isA', 'Comment'],
    ['belongsTo', postId]
  ]
});
```

## Common Patterns

### User Management

```javascript
// Create a user with profile
const user = await client.Attribute.create('keyValue', { name: 'John Doe' });
const profile = await client.Attribute.create('longText', 'John is a developer...');

await client.Fact.createAll([
  [user.id, 'isA', 'User'],
  [profile.id, 'isA', 'Profile'],
  [profile.id, 'belongsTo', user.id],
  [user.id, '$isAccountableFor', user.id],
  [user.id, '$isAccountableFor', profile.id]
]);
```

### Content Management

```javascript
// Create a post with content
const post = await client.Attribute.create('keyValue', { title: 'My Post' });
const content = await client.Attribute.create('longText', 'Post content...');

await client.Fact.createAll([
  [post.id, 'isA', 'Post'],
  [content.id, 'isA', 'Content'],
  [content.id, 'belongsTo', post.id],
  [post.id, 'hasAuthor', userId]
]);
```

### Hierarchical Data

```javascript
// Create a folder structure
const rootFolder = await client.Attribute.create('keyValue', { name: 'Root' });
const subFolder = await client.Attribute.create('keyValue', { name: 'Documents' });

await client.Fact.createAll([
  [rootFolder.id, 'isA', 'Folder'],
  [subFolder.id, 'isA', 'Folder'],
  [subFolder.id, 'belongsTo', rootFolder.id]
]);
```

## Next Steps

- [Authorization](authorization.md) - Learn how to control access using facts
- [Real-time Collaboration](realtime.md) - Understand how facts work with real-time features
- [Advanced Queries](queries.md) - Deep dive into complex query patterns
