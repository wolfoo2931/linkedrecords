---
title: Introduction
layout: home
nav_order: 1
---

# Introduction

You can think of LinkedRecords as a database that you can connect to directly from your
single-page application - no backend code required. All you need is a URL to a LinkedRecords
instance, no setup, no API key, just a URL.

- If you are hosting your own LinkedRecords instance, you can use any OpenID Connect
  provider for authentication, so you don't need to implement login, password reset,
  or similar features. Currently, automated tests run against Auth0, but other providers
  should work as well.
- A flexible authorization model is built into LinkedRecords which allows users and groups
  to share and collaborate on the same data.
- It supports real-time collaboration, using a simple conflict-free replicated
  data type (CRDT) for key-value documents and operational transformation (OT)
  for large text under the hood.

# Concept

You can think of LinkedRecords as a bucket where any user can sign up and insert data.
As long as a user himself doesn't share this data with other users or groups, only this user
can access what this user has written into it.

In theory, any user could use the LinkedRecords API directly to write and retrieve data,
but this would be inconvenient - just as you wouldn't expect your users to write SQL queries,
you wouldn't expect them to interact with the LinkedRecords API. A LinkedRecords app is a
specialized frontend that hides the API and provides a convenient user interface for
accomplishing their tasks.