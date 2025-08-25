---
title: Examples and Tutorials
layout: home
nav_order: 9
---

# Examples and Tutorials

This section provides comprehensive examples and tutorials for building real-world applications with LinkedRecords.

## Getting Started Examples

### Basic Blog Application

A simple blog with posts, comments, and user management:

```javascript
// Initialize the client
const client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));

// Define the blog vocabulary
async function defineBlogVocabulary() {
  await client.Fact.createAll([
    ['Post', '$isATermFor', 'A blog post with content'],
    ['Comment', '$isATermFor', 'A comment on a blog post'],
    ['User', '$isATermFor', 'A user of the blog system'],
    ['hasAuthor', '$isATermFor', 'The author of content'],
    ['hasContent', '$isATermFor', 'The main content of an item'],
    ['belongsTo', '$isATermFor', 'Indicates ownership or association']
  ]);
}

// Create a user
async function createUser(name, email) {
  const user = await client.Attribute.create('keyValue', {
    name,
    email,
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [user.id, 'isA', 'User'],
    [user.id, '$isAccountableFor', user.id]
  ]);

  return user;
}

// Create a blog post
async function createPost(title, content, authorId) {
  const post = await client.Attribute.create('keyValue', {
    title,
    createdAt: new Date().toISOString(),
    status: 'draft'
  });

  const postContent = await client.Attribute.create('longText', content);

  await client.Fact.createAll([
    [post.id, 'isA', 'Post'],
    [postContent.id, 'isA', 'Content'],
    [post.id, 'hasAuthor', authorId],
    [post.id, 'hasContent', postContent.id],
    [postContent.id, 'belongsTo', post.id],
    [authorId, '$isAccountableFor', post.id],
    [authorId, '$isAccountableFor', postContent.id]
  ]);

  return { post, content: postContent };
}

// Add a comment to a post
async function addComment(postId, content, authorId) {
  const comment = await client.Attribute.create('longText', content);

  await client.Fact.createAll([
    [comment.id, 'isA', 'Comment'],
    [comment.id, 'belongsTo', postId],
    [comment.id, 'hasAuthor', authorId],
    [authorId, '$isAccountableFor', comment.id]
  ]);

  return comment;
}

// Get all published posts
async function getPublishedPosts() {
  const { posts } = await client.Attribute.findAll({
    posts: [
      ['isA', 'Post'],
      ['hasStatus', 'published']
    ]
  });

  return posts;
}

// Get posts by author
async function getPostsByAuthor(authorId) {
  const { userPosts } = await client.Attribute.findAll({
    userPosts: [
      ['isA', 'Post'],
      ['hasAuthor', authorId]
    ]
  });

  return userPosts;
}
```

### Todo Application

A collaborative todo application with real-time updates:

```javascript
// Define todo vocabulary
async function defineTodoVocabulary() {
  await client.Fact.createAll([
    ['Todo', '$isATermFor', 'A task to be completed'],
    ['TodoList', '$isATermFor', 'A collection of todos'],
    ['hasStatus', '$isATermFor', 'The current status of an item'],
    ['hasPriority', '$isATermFor', 'The priority level of a todo'],
    ['hasDueDate', '$isATermFor', 'When a todo is due']
  ]);
}

// Create a todo list
async function createTodoList(name, ownerId) {
  const todoList = await client.Attribute.create('keyValue', {
    name,
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [todoList.id, 'isA', 'TodoList'],
    [ownerId, '$isAccountableFor', todoList.id],
    [ownerId, '$canRead', todoList.id],
    [ownerId, '$canWrite', todoList.id]
  ]);

  return todoList;
}

// Add a todo to a list
async function addTodo(listId, title, description, dueDate) {
  const todo = await client.Attribute.create('keyValue', {
    title,
    description,
    dueDate,
    status: 'pending',
    priority: 'medium',
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [todo.id, 'isA', 'Todo'],
    [todo.id, 'belongsTo', listId]
  ]);

  return todo;
}

// Update todo status
async function updateTodoStatus(todoId, status) {
  const todo = await client.Attribute.findById(todoId);
  await todo.patch({ status });
}

// Get todos by status
async function getTodosByStatus(listId, status) {
  const { todos } = await client.Attribute.findAll({
    todos: [
      ['isA', 'Todo'],
      ['belongsTo', listId],
      ['hasStatus', status]
    ]
  });

  return todos;
}

// Real-time todo updates
async function setupTodoCollaboration(todoListId) {
  const todoList = await client.Attribute.findById(todoListId);

  todoList.subscribe((change) => {
    console.log('Todo list updated:', change);
    updateTodoUI(change);
  });
}
```

## Advanced Examples

### Project Management System

A comprehensive project management system with teams, tasks, and milestones:

```javascript
// Define project management vocabulary
async function defineProjectVocabulary() {
  await client.Fact.createAll([
    ['Project', '$isATermFor', 'A project with tasks and milestones'],
    ['Task', '$isATermFor', 'A task within a project'],
    ['Milestone', '$isATermFor', 'A milestone in a project'],
    ['Team', '$isATermFor', 'A team working on a project'],
    ['hasAssignee', '$isATermFor', 'Who is assigned to a task'],
    ['hasProgress', '$isATermFor', 'The progress percentage of an item'],
    ['hasDeadline', '$isATermFor', 'When something is due']
  ]);
}

// Create a project with team
async function createProject(name, description, ownerId) {
  const project = await client.Attribute.create('keyValue', {
    name,
    description,
    status: 'active',
    createdAt: new Date().toISOString()
  });

  const team = await client.Attribute.create('keyValue', {
    name: `${name} Team`,
    members: []
  });

  await client.Fact.createAll([
    [project.id, 'isA', 'Project'],
    [team.id, 'isA', 'Team'],
    [ownerId, '$isAccountableFor', project.id],
    [ownerId, '$isAccountableFor', team.id],
    [ownerId, '$isHostOf', team.id],
    [team.id, '$canRead', project.id],
    [team.id, '$canWrite', project.id]
  ]);

  return { project, team };
}

// Add team member
async function addTeamMember(teamId, userId) {
  await client.Fact.createAll([
    [userId, '$isMemberOf', teamId]
  ]);
}

// Create a task
async function createTask(projectId, title, description, assigneeId, deadline) {
  const task = await client.Attribute.create('keyValue', {
    title,
    description,
    status: 'pending',
    progress: 0,
    deadline,
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [task.id, 'isA', 'Task'],
    [task.id, 'belongsTo', projectId],
    [task.id, 'hasAssignee', assigneeId]
  ]);

  return task;
}

// Update task progress
async function updateTaskProgress(taskId, progress) {
  const task = await client.Attribute.findById(taskId);
  await task.patch({ progress });
}

// Get project dashboard data
async function getProjectDashboard(projectId) {
  const { project, tasks, team, milestones } = await client.Attribute.findAndLoadAll({
    project: projectId,
    tasks: [
      ['isA', 'Task'],
      ['belongsTo', projectId]
    ],
    team: [
      ['isA', 'Team'],
      ['$it', '$canRead', projectId]
    ],
    milestones: [
      ['isA', 'Milestone'],
      ['belongsTo', projectId]
    ]
  });

  return { project, tasks, team, milestones };
}
```

### Social Media Platform

A social media platform with posts, likes, comments, and user relationships:

```javascript
// Define social media vocabulary
async function defineSocialVocabulary() {
  await client.Fact.createAll([
    ['Post', '$isATermFor', 'A social media post'],
    ['Comment', '$isATermFor', 'A comment on a post'],
    ['Like', '$isATermFor', 'A like on a post or comment'],
    ['Follow', '$isATermFor', 'A follow relationship between users'],
    ['hasLikes', '$isATermFor', 'The number of likes on content'],
    ['hasViews', '$isATermFor', 'The number of views on content'],
    ['isPublic', '$isATermFor', 'Whether content is publicly visible']
  ]);
}

// Create a user profile
async function createUserProfile(username, bio, isPublic = true) {
  const profile = await client.Attribute.create('keyValue', {
    username,
    bio,
    isPublic,
    followers: 0,
    following: 0,
    createdAt: new Date().toISOString()
  });

  const userId = await client.ensureUserIdIsKnown();

  await client.Fact.createAll([
    [profile.id, 'isA', 'User'],
    [userId, '$isAccountableFor', profile.id]
  ]);

  return profile;
}

// Create a post
async function createPost(content, isPublic = true) {
  const post = await client.Attribute.create('longText', content);
  const postMeta = await client.Attribute.create('keyValue', {
    likes: 0,
    views: 0,
    isPublic,
    createdAt: new Date().toISOString()
  });

  const userId = await client.ensureUserIdIsKnown();

  await client.Fact.createAll([
    [post.id, 'isA', 'Post'],
    [postMeta.id, 'isA', 'PostMeta'],
    [post.id, 'hasMeta', postMeta.id],
    [post.id, 'hasAuthor', userId],
    [userId, '$isAccountableFor', post.id],
    [userId, '$isAccountableFor', postMeta.id]
  ]);

  return { post, meta: postMeta };
}

// Like a post
async function likePost(postId) {
  const like = await client.Attribute.create('keyValue', {
    createdAt: new Date().toISOString()
  });

  const userId = await client.ensureUserIdIsKnown();

  await client.Fact.createAll([
    [like.id, 'isA', 'Like'],
    [like.id, 'belongsTo', postId],
    [like.id, 'hasUser', userId]
  ]);

  // Update like count
  const postMeta = await client.Attribute.findAll({
    postMeta: [
      ['isA', 'PostMeta'],
      ['$it', 'hasMeta', postId]
    ]
  });

  if (postMeta.postMeta[0]) {
    const currentLikes = await postMeta.postMeta[0].getValue();
    await postMeta.postMeta[0].patch({ likes: currentLikes.likes + 1 });
  }
}

// Follow a user
async function followUser(targetUserId) {
  const follow = await client.Attribute.create('keyValue', {
    createdAt: new Date().toISOString()
  });

  const userId = await client.ensureUserIdIsKnown();

  await client.Fact.createAll([
    [follow.id, 'isA', 'Follow'],
    [follow.id, 'hasFollower', userId],
    [follow.id, 'hasFollowed', targetUserId]
  ]);
}

// Get user feed
async function getUserFeed(userId) {
  const { feedPosts } = await client.Attribute.findAll({
    feedPosts: [
      ['isA', 'Post'],
      ['hasAuthor', '$it'], // The author
      ['$it', 'isFollowedBy', userId] // Who the user follows
    ]
  });

  return feedPosts;
}
```

### E-commerce Platform

An e-commerce platform with products, orders, and inventory management:

```javascript
// Define e-commerce vocabulary
async function defineEcommerceVocabulary() {
  await client.Fact.createAll([
    ['Product', '$isATermFor', 'A product for sale'],
    ['Order', '$isATermFor', 'A customer order'],
    ['Cart', '$isATermFor', 'A shopping cart'],
    ['Category', '$isATermFor', 'A product category'],
    ['hasPrice', '$isATermFor', 'The price of an item'],
    ['hasStock', '$isATermFor', 'The stock quantity of a product'],
    ['hasStatus', '$isATermFor', 'The status of an order or item']
  ]);
}

// Create a product
async function createProduct(name, description, price, stock, categoryId) {
  const product = await client.Attribute.create('keyValue', {
    name,
    description,
    price,
    stock,
    status: 'active',
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [product.id, 'isA', 'Product'],
    [product.id, 'belongsTo', categoryId]
  ]);

  return product;
}

// Create a shopping cart
async function createCart(userId) {
  const cart = await client.Attribute.create('keyValue', {
    items: [],
    total: 0,
    createdAt: new Date().toISOString()
  });

  await client.Fact.createAll([
    [cart.id, 'isA', 'Cart'],
    [cart.id, 'hasUser', userId],
    [userId, '$isAccountableFor', cart.id]
  ]);

  return cart;
}

// Add item to cart
async function addToCart(cartId, productId, quantity) {
  const cart = await client.Attribute.findById(cartId);
  const product = await client.Attribute.findById(productId);

  const cartData = await cart.getValue();
  const productData = await product.getValue();

  const existingItem = cartData.items.find(item => item.productId === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cartData.items.push({
      productId,
      name: productData.name,
      price: productData.price,
      quantity
    });
  }

  cartData.total = cartData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  await cart.set(cartData);
}

// Create an order
async function createOrder(cartId, shippingAddress) {
  const cart = await client.Attribute.findById(cartId);
  const cartData = await cart.getValue();

  const order = await client.Attribute.create('keyValue', {
    items: cartData.items,
    total: cartData.total,
    shippingAddress,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  const userId = await client.ensureUserIdIsKnown();

  await client.Fact.createAll([
    [order.id, 'isA', 'Order'],
    [order.id, 'hasUser', userId],
    [userId, '$isAccountableFor', order.id]
  ]);

  // Clear cart
  await cart.set({ items: [], total: 0 });

  return order;
}

// Get user orders
async function getUserOrders(userId) {
  const { orders } = await client.Attribute.findAll({
    orders: [
      ['isA', 'Order'],
      ['hasUser', userId]
    ]
  });

  return orders;
}
```

## Integration Examples

### React Integration

```jsx
import React, { useState, useEffect } from 'react';
import LinkedRecords from 'linkedrecords/browser_sdk';

function BlogApp() {
  const [client, setClient] = useState(null);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initClient = async () => {
      const lrClient = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));
      await lrClient.ensureUserIdIsKnown();
      setClient(lrClient);
      setUser(await lrClient.ensureUserIdIsKnown());
    };

    initClient();
  }, []);

  useEffect(() => {
    if (client) {
      loadPosts();
    }
  }, [client]);

  const loadPosts = async () => {
    const { posts: fetchedPosts } = await client.Attribute.findAll({
      posts: [
        ['isA', 'Post'],
        ['hasStatus', 'published']
      ]
    });
    setPosts(fetchedPosts);
  };

  const createPost = async (title, content) => {
    const { post } = await createPost(title, content, user);
    await loadPosts();
  };

  return (
    <div>
      <h1>Blog</h1>
      {posts.map(post => (
        <div key={post.id}>
          <h2>{post.value.title}</h2>
          <p>{post.value.content}</p>
        </div>
      ))}
    </div>
  );
}
```

### Vue.js Integration

```vue
<template>
  <div>
    <h1>Todo App</h1>
    <div v-for="todo in todos" :key="todo.id">
      <input
        type="checkbox"
        :checked="todo.value.status === 'completed'"
        @change="updateTodoStatus(todo.id, $event.target.checked ? 'completed' : 'pending')"
      />
      <span>{{ todo.value.title }}</span>
    </div>
  </div>
</template>

<script>
import LinkedRecords from 'linkedrecords/browser_sdk';

export default {
  data() {
    return {
      client: null,
      todos: [],
      user: null
    };
  },
  async mounted() {
    await this.initClient();
  },
  methods: {
    async initClient() {
      this.client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));
      await this.client.ensureUserIdIsKnown();
      this.user = await this.client.ensureUserIdIsKnown();
      await this.loadTodos();
    },
    async loadTodos() {
      const { todos } = await this.client.Attribute.findAll({
        todos: [['isA', 'Todo']]
      });
      this.todos = todos;
    },
    async updateTodoStatus(todoId, status) {
      const todo = await this.client.Attribute.findById(todoId);
      await todo.patch({ status });
    }
  }
};
</script>
```

## Best Practices

### 1. Define Your Vocabulary First

Always define your domain vocabulary before creating data:

```javascript
async function defineVocabulary() {
  await client.Fact.createAll([
    ['User', '$isATermFor', 'A user of the system'],
    ['Post', '$isATermFor', 'A post created by a user'],
    ['hasAuthor', '$isATermFor', 'The author of content'],
    ['belongsTo', '$isATermFor', 'Indicates ownership']
  ]);
}
```

### 2. Use Batch Operations

```javascript
// Good: Batch creation
await client.Fact.createAll([
  [postId, 'isA', 'Post'],
  [postId, 'hasAuthor', userId],
  [postId, 'hasTitle', 'My Post']
]);

// Avoid: Individual creation
await client.Fact.createAll([[postId, 'isA', 'Post']]);
await client.Fact.createAll([[postId, 'hasAuthor', userId]]);
```

### 3. Handle Errors Gracefully

```javascript
async function safeOperation() {
  try {
    const result = await client.Attribute.create('keyValue', data);
    return result;
  } catch (error) {
    if (error.message.includes('Unauthorized')) {
      console.log('Access denied');
    } else {
      console.error('Operation failed:', error);
    }
    throw error;
  }
}
```

### 4. Use Real-time Features

```javascript
// Subscribe to changes for real-time updates
const document = await client.Attribute.findById('doc-id');
document.subscribe((change) => {
  updateUI(change);
});
```

## Next Steps

- [Attributes](attributes.md) - Learn more about data types
- [Facts](facts.md) - Understand relationships
- [Authorization](authorization.md) - Control access to data
- [Real-time Collaboration](realtime.md) - Build collaborative features
