---
title: Getting Started
layout: home
nav_order: 2
---

This page guides you through the process of implementing a small hello world
single page application to get to know the main LinkedRecords features.

The example is using Vite and React but LinkedRecords is not limited to these tools.

# Initialize a new Project

## Setup React Using Vite

Vite is a modern TypeScript/JavaScript build system which bundles our code and prepares it
for deployment. During development it updates the app in the browser as we change the code
in our IDE.

We can use `npm` to create a Vite + TypeScript + React scaffold by running the following
commands in our terminal:

```sh
npm create vite@latest lr-getting-started --- --template react-ts
cd lr-getting-started
npm install
npm run dev
```

You will see an URL in your terminal (e.g. http://localhost:5173/). When you open it
in your browser you will see the small scaffold application in action.

## Clean up Scaffold App

Next, we clean up the scaffold app a little to have a greenfield to start from.

Delete the following files and directory:

```sh
rm public/vite.svg
rm src/App.css
rm -r src/assets
```

And replace the content of `src/App.tsx` with the following:

```tsx
function App() {
  return (
    <div>
      LinkedRecords Hello World
    </div>
  )
}

export default App
```

You can also empty the the file `src/index.css` <strong>but do not delete it</strong>.

If your switch back to your browser, the app should look way simpler now.
You should only see the writing "LinkedRecords Hello World".

## Install NPM Packages

To use LinkedRecords in our React single page application, we need to install the npm package:

```
npm install https://github.com/wolfoo2931/linkedrecords-react --save
npm install react-use --save
```

{: .note }
You can also use linkedrecords outside of React applications. The linkedrecords-react
module provides some handy hooks which make our live easier.

# Implement a Simple todo App

Next we are going to implement a simple todo list application using LinkedRecords.

To make LinkedRecords available in our app we need to wrap it into the LinkedRecords
provider. Replace the content of `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LinkedRecordsProvider } from 'linkedrecords-react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LinkedRecordsProvider serverUrl="http://localhost:6543">
      <App />
    </LinkedRecordsProvider>
  </StrictMode>,
)
```

The LinkedRecords provider expects an URL of the LinkedRecords backend as property (`serverUrl`). In this case it is a
LinkedRecords setup which runs locally.

For the actual app we replace the content of `src/App.tsx` with the following:

```tsx
import { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { useLinkedRecords, useKeyValueAttributes } from 'linkedrecords-react';

function NewTodo() {
  const { lr } = useLinkedRecords();
  const [ title, setTitle ] = useState<string>('');
  const [ state, onClick ] = useAsyncFn(async () => {
    setTitle('');

    await lr.Attribute.createKeyValue({
      title,
      completed: false,
    }, [
      ['$it', 'isA', 'TodoList'],
    ]);
  }, [ lr.Attribute, title ]);

  return <div>
    <input value={title} onChange={(e) => setTitle(e.target.value)}></input>
    <button disabled={state.loading} onClick={onClick}>{state.loading ? 'Saving ...' : 'Save'}</button>
  </div>
}

function TodoList() {
  const { lr } = useLinkedRecords();
  const todos = useKeyValueAttributes([
    ['$it', 'isA', 'TodoList'],
  ]);

  const [ , onCompleted ] = useAsyncFn(async (id: string, checked) => {
    const todoAttr = await lr.Attribute.find(id);
    const todoObj = await todoAttr?.getValue();

    todoAttr?.set({ ...todoObj, completed: checked });
  }, [ lr.Fact ]);

  return <div>
    {todos
      .map((todo) => <div key={todo._id as string}>
        <input onChange={(e) => onCompleted(todo._id as string, e.target.checked)} type="checkbox" checked={!!todo.completed}></input>
        {typeof todo.title === 'string' ? todo.title : 'untitled'}
    </div>)}
  </div>
}

function App() {
  const { lr } = useLinkedRecords();

  useEffect(() => {
    lr.isAuthenticated().then(async (isAuthenticated) => {
      if (!isAuthenticated) {
        await lr.login();
      }

      await lr.Fact.createAll([
        ['TodoList', '$isATermFor', 'A list of things which needs to be done'],
      ]);
    });
  }, [ lr ]);

  return (
    <div>
      <NewTodo/>
      <TodoList/>
    </div>
  );
}

export default App
```

If we start this app in the terminal by running `npm run dev` vite should display a local URL which
we can open in our browser. Once we open the URL in the browser we notice that with very little code:

- We will be prompted to login. The LinkedRecords backend takes care of user management.
- If we reload the page, all todo are persisted.
- If we login as another user, we see different todos. By default the todos are scoped to a user.

In the next sections we will extend the app to learn about a few other LinkedRecords features. Especially
how multiple users can collaborate on the same todos.

# Add an "Archive" feature

This section adds a button next to each todo which allows to archive a todo. Archived todos will
then be listed in a second list and can be unarchived again.

This can be done by applying the following changes to the TodoList component:

```diff
diff --git a/src/App.tsx b/src/App.tsx
index 3195cf6..0ae9803 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -26,6 +26,12 @@ function TodoList() {
   const { lr } = useLinkedRecords();
   const todos = useKeyValueAttributes([
     ['$it', 'isA', 'TodoList'],
+    ['$it', '$latest(stateIs)', '$not(Archived)'],
+  ]);
+
+  const archivedTodos = useKeyValueAttributes([
+    ['$it', 'isA', 'TodoList'],
+    ['$it', '$latest(stateIs)', 'Archived'],
   ]);

   const [ , onCompleted ] = useAsyncFn(async (id: string, checked) => {
@@ -35,11 +41,23 @@ function TodoList() {
     todoAttr?.set({ ...todoObj, completed: checked });
   }, [ lr.Fact ]);

+  const [ , setTodoState ] = useAsyncFn(async (id: string, state: 'Archived' | 'Active') => {
+    await lr.Fact.createAll([[id, 'stateIs', state]]);
+  }, [ lr.Fact ]);
+
   return <div>
     {todos
       .map((todo) => <div key={todo._id as string}>
         <input onChange={(e) => onCompleted(todo._id as string, e.target.checked)} type="checkbox" checked={!!todo.completed}></input>
         {typeof todo.title === 'string' ? todo.title : 'untitled'}
+        <button onClick={() => setTodoState(todo._id as string, 'Archived')}>Archive</button>
+    </div>)}
+
+    Archived:
+    {archivedTodos
+      .map((todo) => <div key={todo._id as string}>
+        {typeof todo.title === 'string' ? todo.title : 'untitled'}
+        <button onClick={() => setTodoState(todo._id as string, 'Active')}>Unarchive</button>
     </div>)}
   </div>
 }
```

We also need to declare two more terms in the main `App` component:

```diff
       await lr.Fact.createAll([
         ['TodoList', '$isATermFor', 'A list of things which needs to be done'],
+        ['Archived', '$isATermFor', 'A state which represent that the subject is archived and is not needed anymore for day-to-day operation'],
+        ['Active', '$isATermFor', 'A state which represent that the subject is archived and is not needed anymore for day-to-day operation'],
       ]);
```

# Add an "Share" feature

Next we are going to implement a share button. Once a user clicks that button, he will
be prompted to provide an email address of the person which he wants to share the todo with.

{: .note }
As of the current state of the implementation the user must be already signed up

To implement the feature, once again we patch the TodoList component with the following few lines:

```diff
diff --git a/src/App.tsx b/src/App.tsx
index 0ae9803..bb91614 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -45,12 +45,30 @@ function TodoList() {
     await lr.Fact.createAll([[id, 'stateIs', state]]);
   }, [ lr.Fact ]);

+  const [ , shareTodo ] = useAsyncFn(async (id: string) => {
+    const email = prompt('enter email');
+
+    if (!email) {
+      return alert('insert valid email');
+    }
+
+    const userId = await lr.getUserIdByEmail(email);
+
+    if (!userId) {
+      return alert('user not found');
+    }
+
+     await lr.Fact.createAll([[userId, '$isMemberOf', id]]);
+
+  }, [ lr.Fact ]);
+
   return <div>
     {todos
       .map((todo) => <div key={todo._id as string}>
         <input onChange={(e) => onCompleted(todo._id as string, e.target.checked)} type="checkbox" checked={!!todo.completed}></input>
         {typeof todo.title === 'string' ? todo.title : 'untitled'}
         <button onClick={() => setTodoState(todo._id as string, 'Archived')}>Archive</button>
+        <button onClick={() => shareTodo(todo._id as string)}>Share</button>
     </div>)}

     Archived:
```