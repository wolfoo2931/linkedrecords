---
title: Introduction
layout: home
nav_order: 1
---

# Introduction

LinkedRecords is a Backend-as-a-Service (BaaS) solution that allows you to build web applications without writing backend code. Think of it as a database that you can connect to directly from your single-page application - no backend code required. All you need is a URL to a LinkedRecords instance, no setup, no API key, just a URL.

## Key Features

- **No Backend Required**: Connect directly from your frontend application
- **OpenID Connect Authentication**: Use any OpenID Connect provider (Auth0, Okta, etc.)
- **Flexible Authorization**: Built-in permission system for sharing and collaboration
- **Real-time Collaboration**: WebSocket-based with conflict-free replicated data types (CRDT) and operational transformation (OT)
- **Multiple Data Types**: Support for key-value documents, long text, and binary blobs
- **Relationship Management**: Create complex relationships between data using facts

## Architecture Overview

LinkedRecords consists of three main components:

1. **Attributes**: The basic building blocks for storing data
2. **Facts**: For creating relationships and metadata between attributes
3. **Authorization**: Built-in permission system for access control

## Getting Started

The quickest way to get started is to include the LinkedRecords SDK in your web application:

```html
<script src="https://unpkg.com/linkedrecords@latest/dist/browser_sdk.js"></script>
```

Then initialize a connection:

```javascript
const client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));
await client.ensureUserIdIsKnown();
```

## Concept

You can think of LinkedRecords as a bucket where any user can sign up and insert data.
As long as a user doesn't share this data with other users or groups, only this user
can access what they have written into it.

In theory, any user could use the LinkedRecords API directly to write and retrieve data,
but this would be inconvenient - just as you wouldn't expect your users to write SQL queries,
you wouldn't expect them to interact with the LinkedRecords API. A LinkedRecords app is a
specialized frontend that hides the API and provides a convenient user interface for
accomplishing their tasks.

## Use Cases

LinkedRecords is ideal for:

- **Collaborative Applications**: Real-time document editing, project management tools
- **Content Management Systems**: Blogs, wikis, knowledge bases
- **Social Applications**: User profiles, social networks, community platforms
- **Business Applications**: CRM systems, task management, team collaboration tools
- **Prototyping**: Rapid application development without backend infrastructure

## Next Steps

- [Installation and Setup](installation.md) - Learn how to set up LinkedRecords
- [Authentication](authentication.md) - Configure OpenID Connect authentication
- [Attributes](attributes.md) - Understand the basic building blocks
- [Facts](facts.md) - Learn about creating relationships between data
- [Authorization](authorization.md) - Set up permissions and access control