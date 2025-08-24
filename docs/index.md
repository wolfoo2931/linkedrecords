---
title: Introduction
layout: home
---

LinkedRecords is a NoSQL database that you can connect to directly from your
single-page application - no backend code required.

- You can use any OpenID Connect provider for authentication, so you don't need
  to implement login, password reset, or similar features. Currently, automated
  tests run against Auth0, but other providers should work as well.
- A flexible authorization model is built into LinkedRecords.
- It supports real-time collaboration, using a simple conflict-free replicated
  data type (CRDT) for key-value documents and operational transformation (OT)
  for large text under the hood.

Developer documentation follows. Curious readers can explore the `specs.wdio/tinytodo`
directory for a simple usage example.

# Concept

You can think of LinkedRecords as a bucket where anyone can sign up and insert data.
As long as you don't share this data with other users or groups, only you can access
what you've written into it.

In theory, any user could use the LinkedRecords API directly to write and retrieve data.
However, this would be inconvenient—just as you wouldn't expect your users to write SQL
queries, you wouldn't expect them to interact with the LinkedRecords API. A LinkedRecords
app is a specialized frontend that hides the API and provides a convenient user interface
for accomplishing their tasks.

In the traditional SQL world, inconvenience isn't the only reason you don't let users
access the database directly - authorization concerns are an even stronger reason.
With LinkedRecords, this is no longer an issue: authorization is built directly into
the API. This requires a small mindset shift: Instead of defining universal authorization
rules in the backend for all records, the user who inserts a data record specifies who
can read it.

Think of it as SQL you can call directly from your React app without worrying about
permissions; it is easier to read than SQL and provides live updates.