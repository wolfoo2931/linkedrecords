---
title: Advanced Queries
layout: home
nav_order: 8
---

# Advanced Queries

LinkedRecords provides powerful querying capabilities through facts and attribute relationships. This guide covers advanced query patterns and techniques for efficiently retrieving and filtering data.

## Query Fundamentals

### Basic Query Structure

All queries in LinkedRecords are based on facts and follow this pattern:

```javascript
const { resultName } = await client.Attribute.findAll({
  resultName: [
    ['predicate1', 'object1'],
    ['predicate2', 'object2'],
    // ... more conditions
  ]
});
```

### Query Components

- **Result Name**: The key that will contain the results
- **Conditions**: Array of fact patterns to match
- **Subject Placeholder**: `$it` represents the attribute being queried

## Complex Query Patterns

### Multi-Condition Queries

```javascript
// Find posts that are published and belong to a specific user
const { publishedPosts } = await client.Attribute.findAll({
  publishedPosts: [
    ['isA', 'Post'],
    ['belongsTo', userId],
    ['hasStatus', 'published']
  ]
});
```

### Nested Relationship Queries

```javascript
// Find comments on posts by a specific author
const { userPostComments } = await client.Attribute.findAll({
  userPostComments: [
    ['isA', 'Comment'],
    ['belongsTo', '$it'], // The post
    ['$it', 'hasAuthor', userId] // The post's author
  ]
});
```

### Composition Queries

Use `findAndLoadAll` to load related data in a single query:

```javascript
const { project, tasks, team } = await client.Attribute.findAndLoadAll({
  project: projectId,
  tasks: [
    ['isA', 'Task'],
    ['belongsTo', projectId]
  ],
  team: [
    ['isA', 'Team'],
    ['$it', '$isAccountableFor', projectId]
  ]
});
```

## Advanced Filtering

### Date Range Queries

```javascript
// Find posts created in the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const { recentPosts } = await client.Attribute.findAll({
  recentPosts: [
    ['isA', 'Post'],
    ['hasCreatedAt', '>', thirtyDaysAgo]
  ]
});
```

### Status-Based Filtering

```javascript
// Find tasks by status
const { pendingTasks, completedTasks } = await client.Attribute.findAll({
  pendingTasks: [
    ['isA', 'Task'],
    ['hasStatus', 'pending']
  ],
  completedTasks: [
    ['isA', 'Task'],
    ['hasStatus', 'completed']
  ]
});
```

### User-Specific Queries

```javascript
// Find all data the current user has access to
const userId = await client.ensureUserIdIsKnown();

const { userData } = await client.Attribute.findAll({
  userData: [
    ['$it', '$isAccountableFor', userId]
  ]
});

// Find data shared with the user
const { sharedData } = await client.Attribute.findAll({
  sharedData: [
    ['$it', '$canRead', userId]
  ]
});
```

## Hierarchical Queries

### Folder Structure Queries

```javascript
// Find all items in a folder hierarchy
const { folderContents } = await client.Attribute.findAll({
  folderContents: [
    ['isA', 'Document'],
    ['belongsTo', folderId]
  ]
});

// Find subfolders
const { subfolders } = await client.Attribute.findAll({
  subfolders: [
    ['isA', 'Folder'],
    ['belongsTo', parentFolderId]
  ]
});
```

### Organization Hierarchy

```javascript
// Find all teams in an organization
const { orgTeams } = await client.Attribute.findAll({
  orgTeams: [
    ['isA', 'Team'],
    ['belongsTo', organizationId]
  ]
});

// Find all members of all teams in an organization
const { orgMembers } = await client.Attribute.findAll({
  orgMembers: [
    ['isA', 'User'],
    ['$isMemberOf', '$it'], // Member of a team
    ['$it', 'belongsTo', organizationId] // That belongs to the org
  ]
});
```

## Permission-Aware Queries

### Querying with Authorization

```javascript
// Find all projects the user can access
const userId = await client.ensureUserIdIsKnown();

const { accessibleProjects } = await client.Attribute.findAll({
  accessibleProjects: [
    ['isA', 'Project'],
    ['$it', '$canRead', userId]
  ]
});

// Find projects the user owns
const { ownedProjects } = await client.Attribute.findAll({
  ownedProjects: [
    ['isA', 'Project'],
    ['$it', '$isAccountableFor', userId]
  ]
});
```

### Group-Based Queries

```javascript
// Find all data accessible to a team
const { teamData } = await client.Attribute.findAll({
  teamData: [
    ['$it', '$canRead', teamId]
  ]
});

// Find team members
const { teamMembers } = await client.Attribute.findAll({
  teamMembers: [
    ['isA', 'User'],
    ['$isMemberOf', teamId]
  ]
});
```

## Performance Optimization

### Batch Queries

```javascript
// Load multiple related datasets in one query
const { users, posts, comments } = await client.Attribute.findAndLoadAll({
  users: [['isA', 'User']],
  posts: [
    ['isA', 'Post'],
    ['hasStatus', 'published']
  ],
  comments: [
    ['isA', 'Comment'],
    ['hasStatus', 'approved']
  ]
});
```

### Pagination

```javascript
// Implement pagination for large datasets
async function getPaginatedPosts(page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  // Get total count
  const { totalPosts } = await client.Attribute.findAll({
    totalPosts: [['isA', 'Post']]
  });

  // Get paginated results
  const { posts } = await client.Attribute.findAll({
    posts: [
      ['isA', 'Post'],
      ['hasCreatedAt', '>', getOffsetDate(offset)]
    ]
  });

  return {
    posts: posts.slice(0, limit),
    total: totalPosts.length,
    page,
    totalPages: Math.ceil(totalPosts.length / limit)
  };
}
```

### Caching Strategies

```javascript
// Cache frequently accessed data
const cache = new Map();

async function getCachedUser(userId) {
  if (cache.has(userId)) {
    return cache.get(userId);
  }

  const { user } = await client.Attribute.findAndLoadAll({
    user: userId
  });

  cache.set(userId, user);
  return user;
}
```

## Complex Business Logic Queries

### Project Management Queries

```javascript
// Find overdue tasks
const today = new Date().toISOString().split('T')[0];

const { overdueTasks } = await client.Attribute.findAll({
  overdueTasks: [
    ['isA', 'Task'],
    ['hasStatus', 'pending'],
    ['hasDueDate', '<', today]
  ]
});

// Find tasks assigned to a user
const { assignedTasks } = await client.Attribute.findAll({
  assignedTasks: [
    ['isA', 'Task'],
    ['hasAssignee', userId]
  ]
});
```

### Content Management Queries

```javascript
// Find published content by category
const { publishedContent } = await client.Attribute.findAll({
  publishedContent: [
    ['isA', 'Content'],
    ['hasStatus', 'published'],
    ['hasCategory', categoryId]
  ]
});

// Find content with specific tags
const { taggedContent } = await client.Attribute.findAll({
  taggedContent: [
    ['isA', 'Content'],
    ['hasTag', tagName]
  ]
});
```

### Social Media Style Queries

```javascript
// Find posts from followed users
const { feedPosts } = await client.Attribute.findAll({
  feedPosts: [
    ['isA', 'Post'],
    ['hasAuthor', '$it'], // The author
    ['$it', 'isFollowedBy', userId] // Who the user follows
  ]
});

// Find trending posts (posts with many likes)
const { trendingPosts } = await client.Attribute.findAll({
  trendingPosts: [
    ['isA', 'Post'],
    ['hasLikeCount', '>', 100]
  ]
});
```

## Query Optimization Tips

### 1. Use Specific Predicates

```javascript
// Good: Specific predicates
const { userPosts } = await client.Attribute.findAll({
  userPosts: [
    ['isA', 'Post'],
    ['hasAuthor', userId]
  ]
});

// Avoid: Generic predicates that require additional filtering
const { allPosts } = await client.Attribute.findAll({
  allPosts: [['isA', 'Post']]
});
// Then filter in JavaScript
```

### 2. Leverage Fact Indexing

```javascript
// Use indexed facts for better performance
await client.Fact.createAll([
  [postId, 'hasAuthor', userId],
  [postId, 'hasStatus', 'published'],
  [postId, 'hasCategory', categoryId]
]);
```

### 3. Combine Related Queries

```javascript
// Good: Single query for related data
const { projectData } = await client.Attribute.findAndLoadAll({
  project: projectId,
  tasks: [['belongsTo', projectId]],
  team: [['$isAccountableFor', projectId]]
});

// Avoid: Multiple separate queries
const project = await client.Attribute.findById(projectId);
const tasks = await client.Attribute.findAll({ tasks: [['belongsTo', projectId]] });
const team = await client.Attribute.findAll({ team: [['$isAccountableFor', projectId]] });
```

### 4. Use Composition for Complex Relationships

```javascript
// Complex relationship query
const { userActivity } = await client.Attribute.findAndLoadAll({
  userPosts: [
    ['isA', 'Post'],
    ['hasAuthor', userId]
  ],
  userComments: [
    ['isA', 'Comment'],
    ['hasAuthor', userId]
  ],
  userLikes: [
    ['isA', 'Like'],
    ['hasUser', userId]
  ]
});
```

## Error Handling

### Query Error Handling

```javascript
try {
  const { results } = await client.Attribute.findAll({
    results: [['isA', 'SomeType']]
  });
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    console.log('Access denied to query results');
  } else if (error.message.includes('Invalid query')) {
    console.log('Query syntax error');
  } else {
    console.error('Query failed:', error);
  }
}
```

### Graceful Degradation

```javascript
async function getDataWithFallback() {
  try {
    // Try complex query first
    const { complexResults } = await client.Attribute.findAll({
      complexResults: [
        ['isA', 'ComplexType'],
        ['hasComplexCondition', 'value']
      ]
    });
    return complexResults;
  } catch (error) {
    // Fallback to simpler query
    const { simpleResults } = await client.Attribute.findAll({
      simpleResults: [['isA', 'ComplexType']]
    });
    return simpleResults;
  }
}
```

## Next Steps

- [Real-time Collaboration](realtime.md) - Query data in real-time
- [Authorization](authorization.md) - Understand how permissions affect queries
- [Performance Optimization](performance.md) - Optimize query performance
