# FarmTrack — Developer Documentation

This directory contains reference documentation for the FarmTrack full-stack farm management application.

## Contents

| Document | Description |
|---|---|
| [backend.md](./backend.md) | Node.js/Express REST API — stack, setup, all endpoints, Prisma schema, middleware, folder structure |
| [frontend.md](./frontend.md) | Expo/React Native mobile app — stack, setup, screens, WatermelonDB, sync service, navigation, auth flow |

## Project Overview

FarmTrack is a mobile-first farm management application that lets farmers track projects, budget items, expenses, employees, work entries, payments, and inventory. The mobile app works offline using a local WatermelonDB SQLite database and syncs data from the backend API on demand.

## Repository Structure

```
Node_Proj/
├── backend/          # Express REST API
│   ├── prisma/       # Prisma schema and migrations
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── validators/
│   │   └── lib/
│   └── server.js
├── frontend/         # Expo React Native app
│   ├── src/
│   │   ├── db/       # WatermelonDB schema and models
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── store/
│   │   ├── hooks/
│   │   └── lib/
│   └── App.js
└── docs/             # This documentation
    ├── README.md     # (this file)
    ├── backend.md
    └── frontend.md
```
