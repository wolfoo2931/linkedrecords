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

To use LinkedRecords in our single page application, we need to install the npm package:

```
npm install https://github.com/wolfoo2931/linkedrecords --save
npm install react-use --save
```

#
