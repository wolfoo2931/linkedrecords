---
title: Authorization
layout: home
nav_order: 5
---

# Authorization

LinkedRecords includes a flexible authorization system that allows you to control who can access, modify, and share data. The authorization model is based on facts and provides fine-grained control over permissions.

## Overview

The authorization system in LinkedRecords is built around several key concepts:

- **Accountability**: Who is responsible for data
- **Permissions**: What actions users can perform
- **Groups**: Collections of users with shared permissions
- **Inheritance**: How permissions are passed down through relationships

## Core Concepts

### Accountability

Every piece of data in LinkedRecords has an accountable party - the user or group responsible for it. This is established using the `$isAccountableFor` fact:

```javascript
// User is accountable for their own profile
await client.Fact.createAll([
  [userId, '$isAccountableFor', profileId]
]);
```

### Permission Types

LinkedRecords supports several types of permissions:

- `$canRead` - Permission to read data
- `$canWrite` - Permission to write/modify data
- `$canDelete` - Permission to delete data
- `$canReferTo` - Permission to reference data in facts
- `$canRefine` - Permission to modify relationships
- `$isMemberOf` - Membership in a group
- `$isHostOf` - Hosting relationship for groups

## Basic Authorization

### Default Access

By default, users can only access data they are accountable for:

```javascript
// Create a user profile
const user = await client.Attribute.create('keyValue', { name: 'John Doe' });
const profile = await client.Attribute.create('longText', 'John is a developer...');

// Set up accountability
await client.Fact.createAll([
  [user.id, 'isA', 'User'],
  [profile.id, 'isA', 'Profile'],
  [profile.id, 'belongsTo', user.id],
  [user.id, '$isAccountableFor', user.id],
  [user.id, '$isAccountableFor', profile.id]
]);
```

### Granting Access

To allow other users to access your data, create permission facts:

```javascript
// Allow another user to read your profile
await client.Fact.createAll([
  [otherUserId, '$canRead', profileId]
]);

// Allow another user to write to your profile
await client.Fact.createAll([
  [otherUserId, '$canWrite', profileId]
]);
```

## Group-Based Authorization

### Creating Groups

Groups allow you to manage permissions for multiple users at once:

```javascript
// Create a group
const team = await client.Attribute.create('keyValue', { name: 'Development Team' });

// Set up the group
await client.Fact.createAll([
  [team.id, 'isA', 'Team'],
  [userId, '$isAccountableFor', team.id],
  [userId, '$isHostOf', team.id] // User can add members to the team
]);
```

### Adding Members to Groups

```javascript
// Add users to the team
await client.Fact.createAll([
  [user1Id, '$isMemberOf', team.id],
  [user2Id, '$isMemberOf', team.id],
  [user3Id, '$isMemberOf', team.id]
]);
```

### Group Permissions

Grant permissions to entire groups:

```javascript
// Give the team access to a project
await client.Fact.createAll([
  [team.id, '$canRead', projectId],
  [team.id, '$canWrite', projectId]
]);
```

## Advanced Authorization Patterns

### Project Management

```javascript
// Create a project with team access
const project = await client.Attribute.create('keyValue', { name: 'My Project' });
const projectContent = await client.Attribute.create('longText', 'Project description...');

// Set up project structure
await client.Fact.createAll([
  [project.id, 'isA', 'Project'],
  [projectContent.id, 'isA', 'ProjectContent'],
  [projectContent.id, 'belongsTo', project.id],
  [userId, '$isAccountableFor', project.id],
  [userId, '$isAccountableFor', projectContent.id],

  // Team permissions
  [team.id, '$canRead', project.id],
  [team.id, '$canRead', projectContent.id],
  [team.id, '$canWrite', projectContent.id],

  // Team members can reference the project
  [team.id, '$canReferTo', project.id]
]);
```

### Hierarchical Permissions

```javascript
// Create an organization with teams
const org = await client.Attribute.create('keyValue', { name: 'My Organization' });
const adminTeam = await client.Attribute.create('keyValue', { name: 'Admin Team' });
const devTeam = await client.Attribute.create('keyValue', { name: 'Development Team' });

// Set up hierarchy
await client.Fact.createAll([
  [org.id, 'isA', 'Organization'],
  [adminTeam.id, 'isA', 'AdminTeam'],
  [devTeam.id, 'isA', 'DevTeam'],

  // Organization owns teams
  [org.id, '$isAccountableFor', adminTeam.id],
  [org.id, '$isAccountableFor', devTeam.id],

  // Admin team has full access
  [adminTeam.id, '$canRead', org.id],
  [adminTeam.id, '$canWrite', org.id],
  [adminTeam.id, '$canRefine', org.id],

  // Dev team has limited access
  [devTeam.id, '$canRead', org.id],
  [devTeam.id, '$canReferTo', org.id]
]);
```

### Content Sharing

```javascript
// Create a document that can be shared
const document = await client.Attribute.create('longText', 'Shared document content...');

// Owner permissions
await client.Fact.createAll([
  [userId, '$isAccountableFor', document.id],
  [userId, '$canRead', document.id],
  [userId, '$canWrite', document.id],
  [userId, '$canDelete', document.id]
]);

// Share with specific users
await client.Fact.createAll([
  [friendId, '$canRead', document.id],
  [colleagueId, '$canRead', document.id],
  [colleagueId, '$canWrite', document.id] // Allow editing
]);
```

## Permission Inheritance

### Automatic Inheritance

Some permissions are automatically inherited:

```javascript
// If a user can read a project, they can also read project metadata
await client.Fact.createAll([
  [userId, '$canRead', projectId]
]);

// The user can now read project facts and metadata
const projectFacts = await client.Fact.findAll({
  subject: [projectId]
});
```

### Explicit Inheritance

You can set up explicit inheritance patterns:

```javascript
// Create a folder structure with inherited permissions
const rootFolder = await client.Attribute.create('keyValue', { name: 'Root' });
const subFolder = await client.Attribute.create('keyValue', { name: 'Documents' });

await client.Fact.createAll([
  [rootFolder.id, 'isA', 'Folder'],
  [subFolder.id, 'isA', 'Folder'],
  [subFolder.id, 'belongsTo', rootFolder.id],

  // Team has access to root folder
  [team.id, '$canRead', rootFolder.id],
  [team.id, '$canWrite', rootFolder.id],

  // Explicitly grant same permissions to subfolder
  [team.id, '$canRead', subFolder.id],
  [team.id, '$canWrite', subFolder.id]
]);
```

## Checking Permissions

### Query Permissions

```javascript
// Check if user can see members of a group
const canSeeMembers = await client.isAuthorizedToSeeMemberOf(teamId);
if (canSeeMembers) {
  const members = await client.getMembersOf(teamId);
  console.log('Team members:', members);
}
```

### Authorization Errors

LinkedRecords will throw authorization errors when access is denied:

```javascript
try {
  const data = await client.Attribute.findById(protectedAttributeId);
  const value = await data.getValue();
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    console.log('Access denied to this attribute');
  }
}
```

## Best Practices

### 1. Principle of Least Privilege

Grant only the minimum permissions necessary:

```javascript
// Good: Grant specific permissions
await client.Fact.createAll([
  [userId, '$canRead', documentId],
  [userId, '$canWrite', documentId]
]);

// Avoid: Granting unnecessary permissions
await client.Fact.createAll([
  [userId, '$canDelete', documentId] // Only if really needed
]);
```

### 2. Use Groups for Scalability

```javascript
// Good: Use groups for team permissions
await client.Fact.createAll([
  [team.id, '$canRead', projectId],
  [team.id, '$canWrite', projectId]
]);

// Avoid: Granting permissions to individual users
await client.Fact.createAll([
  [user1.id, '$canRead', projectId],
  [user2.id, '$canRead', projectId],
  [user3.id, '$canRead', projectId],
  // ... repeat for each user
]);
```

### 3. Document Your Permission Model

```javascript
// Define your permission vocabulary
await client.Fact.createAll([
  ['Team', '$isATermFor', 'A group of users with shared permissions'],
  ['Project', '$isATermFor', 'A collection of related work items'],
  ['$canRead', '$isATermFor', 'Permission to view data'],
  ['$canWrite', '$isATermFor', 'Permission to modify data'],
  ['$isMemberOf', '$isATermFor', 'Membership in a group']
]);
```

### 4. Regular Permission Audits

```javascript
// Query for all permissions granted to a user
const userPermissions = await client.Fact.findAll({
  subject: [userId],
  predicate: ['$canRead', '$canWrite', '$canDelete', '$canReferTo', '$canRefine']
});

console.log('User permissions:', userPermissions);
```

## Common Patterns

### Public Data

```javascript
// Make data publicly readable
const publicPost = await client.Attribute.create('longText', 'Public content...');

await client.Fact.createAll([
  [userId, '$isAccountableFor', publicPost.id],
  // Grant read access to everyone (use a special identifier)
  ['public', '$canRead', publicPost.id]
]);
```

### Private Data

```javascript
// Keep data private (default behavior)
const privateNote = await client.Attribute.create('longText', 'Private note...');

await client.Fact.createAll([
  [userId, '$isAccountableFor', privateNote.id]
  // No additional permissions = private to owner
]);
```

### Collaborative Data

```javascript
// Create collaborative workspace
const workspace = await client.Attribute.create('keyValue', { name: 'Collaborative Workspace' });

await client.Fact.createAll([
  [userId, '$isAccountableFor', workspace.id],
  [team.id, '$canRead', workspace.id],
  [team.id, '$canWrite', workspace.id],
  [team.id, '$canReferTo', workspace.id]
]);
```

## Next Steps

- [Real-time Collaboration](realtime.md) - Learn how authorization works with real-time features
- [Advanced Queries](queries.md) - Query data with authorization filters
- [Security Best Practices](security.md) - Additional security considerations
